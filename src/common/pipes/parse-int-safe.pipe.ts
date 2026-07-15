import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseIntSafePipe implements PipeTransform<string, number | null> {
  transform(value: string): number | null {
    if (!value) return null;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new BadRequestException(`Invalid integer: ${value}`);
    }
    return parsed;
  }
}
