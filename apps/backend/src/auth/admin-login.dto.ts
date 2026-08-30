import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Length limits here are about bounding input, not about password strength —
 * the strength requirement belongs where the credential is configured, and
 * lives in env.validation.ts.
 */
export class AdminLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
