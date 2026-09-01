import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Attendee, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import { UpdateAttendeeDto } from './dto/update-attendee.dto';
import { QueryAttendeesDto } from './dto/query-attendees.dto';
import { mapAttendeeRows, parseCsv, summarizeCsvResult } from './csv.util';

/** Default pass type applied when an attendee row does not specify one. */
const DEFAULT_PASS_TYPE = 'General';

export interface LatestPass {
  id: string;
  revokedAt: Date | null;
}

export interface AttendeeWithRelations extends Attendee {
  pass: LatestPass | null;
  checkIn: { scannedAt: Date } | null;
}

export interface CsvImportResult {
  totalRows: number;
  created: number;
  duplicates: number;
  errors: { rowNumber: number; message: string }[];
  message: string;
}

interface AttendeeAccessProbe {
  id: string;
  eventId: string;
  email: string;
  event: { organizerId: string };
}

@Injectable()
export class AttendeesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Verifies the requester owns the event that an attendee belongs to. */
  private async assertEventOwner(eventId: string, userId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true },
    });
    if (!event) {
      throw new NotFoundException(`Event with id ${eventId} not found`);
    }
    if (event.organizerId !== userId) {
      throw new ForbiddenException('You do not have access to this event');
    }
  }

  private async assertAttendeeAccess(
    id: string,
    userId: string,
  ): Promise<AttendeeAccessProbe> {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        email: true,
        event: { select: { organizerId: true } },
      },
    });
    if (!attendee) {
      throw new NotFoundException(`Attendee with id ${id} not found`);
    }
    if (attendee.event.organizerId !== userId) {
      throw new ForbiddenException('You do not have access to this attendee');
    }
    return attendee;
  }

  /** Creates a fresh, active pass for an attendee. The pass UUID is the
   *  unguessable token encoded in the QR code (PRD §7). */
  private issuePass(attendeeId: string) {
    return this.prisma.pass.create({ data: { attendeeId } });
  }

  async create(
    eventId: string,
    dto: CreateAttendeeDto,
    userId: string,
  ): Promise<AttendeeWithRelations> {
    await this.assertEventOwner(eventId, userId);

    const existing = await this.prisma.attendee.findUnique({
      where: { eventId_email: { eventId, email: dto.email.toLowerCase() } },
    });
    if (existing) {
      throw new ConflictException('An attendee with this email already exists');
    }

    const attendee = await this.prisma.attendee.create({
      data: {
        eventId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        passType: dto.passType?.trim() || DEFAULT_PASS_TYPE,
      },
    });

    // Issue their pass immediately (same flow as the CSV import).
    await this.issuePass(attendee.id);

    return this.findOne(attendee.id, userId);
  }

  async findAll(
    eventId: string,
    userId: string,
    query: QueryAttendeesDto,
  ): Promise<{ data: AttendeeWithRelations[]; total: number }> {
    await this.assertEventOwner(eventId, userId);

    const where: Prisma.AttendeeWhereInput = { eventId };
    if (query.search) {
      const q = query.search.toLowerCase();
      where.OR = [{ name: { contains: q } }, { email: { contains: q } }];
    }
    if (query.passType) {
      where.passType = query.passType;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.attendee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: {
          passes: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { checkIn: true },
          },
        },
      }),
      this.prisma.attendee.count({ where }),
    ]);

    return {
      data: data.map((attendee) => this.toWithRelations(attendee)),
      total,
    };
  }

  async findOne(id: string, userId: string): Promise<AttendeeWithRelations> {
    await this.assertAttendeeAccess(id, userId);

    const attendee = await this.prisma.attendee.findUnique({
      where: { id },
      include: {
        passes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { checkIn: true },
        },
      },
    });
    if (!attendee) {
      throw new NotFoundException(`Attendee with id ${id} not found`);
    }
    return this.toWithRelations(attendee);
  }

  /**
   * Updates an attendee. Changing the email revokes the current pass and
   * issues a fresh one in the same transaction, so the old QR code stops
   * working immediately (PRD §4.4 "resend pass", §7 regeneration rule).
   */
  async update(
    id: string,
    dto: UpdateAttendeeDto,
    userId: string,
  ): Promise<AttendeeWithRelations> {
    const existing = await this.assertAttendeeAccess(id, userId);

    const nextEmail =
      dto.email !== undefined ? dto.email.toLowerCase() : undefined;
    const emailChanged =
      nextEmail !== undefined && nextEmail !== existing.email.toLowerCase();

    if (emailChanged) {
      const duplicate = await this.prisma.attendee.findUnique({
        where: {
          eventId_email: { eventId: existing.eventId, email: nextEmail! },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          'An attendee with this email already exists',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.attendee.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(nextEmail !== undefined && { email: nextEmail }),
          ...(dto.passType !== undefined && {
            passType: dto.passType.trim() || DEFAULT_PASS_TYPE,
          }),
        },
      });

      if (emailChanged) {
        await tx.pass.updateMany({
          where: { attendeeId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.pass.create({ data: { attendeeId: id } });
      }
    });

    return this.findOne(id, userId);
  }

  /** Removes an attendee; their passes and check-ins cascade (schema-level). */
  async remove(id: string, userId: string): Promise<void> {
    await this.assertAttendeeAccess(id, userId);
    await this.prisma.attendee.delete({ where: { id } });
  }

  /**
   * Imports attendees from a CSV buffer. Rows with errors are skipped and
   * reported; duplicates are skipped and counted. A bad row never aborts the
   * whole upload (PRD §4.4).
   */
  async importCsv(
    eventId: string,
    userId: string,
    buffer: Buffer,
  ): Promise<CsvImportResult> {
    await this.assertEventOwner(eventId, userId);

    const text = buffer.toString('utf8');
    if (!text.trim()) {
      throw new BadRequestException('Uploaded file is empty');
    }

    const mapped = mapAttendeeRows(parseCsv(text));
    const errors = [...mapped.errors];
    let created = 0;
    let duplicates = 0;

    for (const row of mapped.rows) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const existing = await tx.attendee.findUnique({
            where: {
              eventId_email: { eventId, email: row.email.toLowerCase() },
            },
            select: { id: true },
          });
          if (existing) {
            duplicates++;
            return;
          }
          const attendee = await tx.attendee.create({
            data: {
              eventId,
              name: row.name,
              email: row.email.toLowerCase(),
              passType: row.passType?.trim() || DEFAULT_PASS_TYPE,
            },
          });
          await tx.pass.create({ data: { attendeeId: attendee.id } });
          created++;
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unexpected database error';
        errors.push({ rowNumber: 0, message: `Import failed for this row: ${message}` });
      }
    }

    return {
      totalRows: mapped.rows.length,
      created,
      duplicates,
      errors,
      message: summarizeCsvResult({
        total: mapped.rows.length,
        created,
        duplicates,
        errors,
      }),
    };
  }

  private toWithRelations(attendee: {
    id: string;
    eventId: string;
    name: string;
    email: string;
    passType: string;
    createdAt: Date;
    updatedAt: Date;
    passes: { id: string; revokedAt: Date | null; checkIn: { scannedAt: Date } | null }[];
  }): AttendeeWithRelations {
    const latestPass = attendee.passes[0] ?? null;
    return {
      id: attendee.id,
      eventId: attendee.eventId,
      name: attendee.name,
      email: attendee.email,
      passType: attendee.passType,
      createdAt: attendee.createdAt,
      updatedAt: attendee.updatedAt,
      pass: latestPass
        ? { id: latestPass.id, revokedAt: latestPass.revokedAt }
        : null,
      checkIn: latestPass?.checkIn ?? null,
    };
  }
}