import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseCursorPipe implements PipeTransform<string, string | null> {
  transform(value: string): string | null {
    if (!value) return null;
    try {
      const decoded = Buffer.from(value, 'base64').toString('utf-8');
      const parts = decoded.split('::');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new BadRequestException('Invalid cursor format');
      }
      return value;
    } catch {
      throw new BadRequestException('Invalid cursor format');
    }
  }
}
