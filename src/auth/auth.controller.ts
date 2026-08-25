import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  LoginResponseDto,
  MessageResponseDto,
  RegisterResponseDto,
  VerifyEmailResponseDto,
} from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifySessionDto } from './dto/verify-session.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates the user in Supabase Auth and triggers the email-verification flow. No passwords are stored by this API.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Credentials are verified against Supabase Auth. Unverified accounts are rejected. Returns a JWT issued by this API.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm an email verification link (Supabase Auth)',
    description:
      'Accepts the credential from the verification email: token_hash/token (implicit flow) or code (PKCE flow). Delegates verification to Supabase.',
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiOkResponse({ type: VerifyEmailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('verify-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm an email and complete sign-in using a Supabase session token',
    description:
      'Handles the implicit-flow confirmation link whose URL hash carries an access_token (no relay-able token_hash). Validates the Supabase token and returns a JWT issued by this API.',
  })
  @ApiBody({ type: VerifySessionDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired session token' })
  verifySession(@Body() dto: VerifySessionDto) {
    return this.authService.verifySession(dto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend the email verification message',
    description: 'Always returns the same response to avoid account enumeration.',
  })
  @ApiBody({ type: ResendVerificationDto })
  @ApiOkResponse({ type: MessageResponseDto })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset email (Supabase-managed)',
    description:
      'Supabase sends a recovery email with a link to the frontend reset page. Always returns the same response to avoid account enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password using the recovery link credential',
    description:
      'Accepts token_hash/token (implicit flow) or code (PKCE flow) from the reset email plus the new password. The password is stored only in Supabase Auth.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset link' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiOkResponse({ description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Missing/invalid/expired token' })
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user.id);
  }
}
