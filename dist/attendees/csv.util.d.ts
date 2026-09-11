export interface CsvParseRow {
    values: string[];
    rowNumber: number;
}
export declare function parseCsv(input: string): CsvParseRow[];
export declare function isEmail(value: string): boolean;
export declare function cleanValue(value: string): string;
export interface AttendeeRow {
    name: string;
    email: string;
    passType?: string;
}
export interface AttendeeParseResult {
    rows: AttendeeRow[];
    errors: {
        rowNumber: number;
        message: string;
    }[];
    headerRowNumber: number;
}
export declare function mapAttendeeRows(parsed: CsvParseRow[]): AttendeeParseResult;
export declare function summarizeCsvResult(args: {
    total: number;
    created: number;
    duplicates: number;
    errors: {
        rowNumber: number;
        message: string;
    }[];
}): string;
