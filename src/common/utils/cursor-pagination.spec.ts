import { parseCursor, encodeCursor } from './cursor-pagination';

describe('Cursor Pagination', () => {
  describe('encodeCursor', () => {
    it('should encode id and createdAt into base64', () => {
      const date = new Date('2026-07-13T00:00:00.000Z');
      const cursor = encodeCursor('abc123', date);
      expect(typeof cursor).toBe('string');
      expect(cursor.length).toBeGreaterThan(0);
    });
  });

  describe('parseCursor', () => {
    it('should return null for undefined', () => {
      expect(parseCursor(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseCursor('')).toBeNull();
    });

    it('should return null for invalid base64', () => {
      expect(parseCursor('not-valid-base64!!!')).toBeNull();
    });

    it('should return null for valid base64 but invalid format', () => {
      const invalid = Buffer.from('no-separator').toString('base64');
      expect(parseCursor(invalid)).toBeNull();
    });

    it('should parse a valid cursor', () => {
      const date = new Date('2026-07-13T12:00:00.000Z');
      const encoded = encodeCursor('post123', date);
      const parsed = parseCursor(encoded);

      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe('post123');
      expect(parsed!.createdAt).toBe(date.toISOString());
    });

    it('should roundtrip multiple times consistently', () => {
      const date = new Date('2026-01-01T00:00:00.000Z');
      const id = 'cxyz789';
      const encoded = encodeCursor(id, date);
      const decoded = parseCursor(encoded);
      const reEncoded = encodeCursor(decoded!.id, new Date(decoded!.createdAt));

      expect(reEncoded).toBe(encoded);
    });
  });
});
