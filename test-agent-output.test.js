const fs = require('fs');
const path = require('path');

describe('Test Agent Output File Validation', () => {
  const outputFilePath = path.join(__dirname, 'test-agent-output.txt');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Existence and Accessibility', () => {
    test('should have test-agent-output.txt file in repository root', () => {
      expect(fs.existsSync(outputFilePath)).toBe(true);
    });

    test('should be readable', () => {
      expect(() => {
        fs.accessSync(outputFilePath, fs.constants.R_OK);
      }).not.toThrow();
    });

    test('should have non-zero file size', () => {
      const stats = fs.statSync(outputFilePath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('File Content Validation', () => {
    let fileContent;

    beforeEach(() => {
      fileContent = fs.readFileSync(outputFilePath, 'utf8');
    });

    test('should contain agent ID line', () => {
      expect(fileContent).toMatch(/^Agent ID: test_agent$/m);
    });

    test('should contain timestamp line', () => {
      expect(fileContent).toMatch(/^Timestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/m);
    });

    test('should have exactly two lines', () => {
      const lines = fileContent.trim().split('\n');
      expect(lines).toHaveLength(2);
    });

    test('should have proper line format structure', () => {
      const lines = fileContent.trim().split('\n');
      expect(lines[0]).toMatch(/^Agent ID: .+$/);
      expect(lines[1]).toMatch(/^Timestamp: .+$/);
    });

    test('should have valid ISO 8601 timestamp format', () => {
      const lines = fileContent.trim().split('\n');
      const timestampLine = lines[1];
      const timestamp = timestampLine.replace('Timestamp: ', '');
      
      // Validate ISO 8601 format
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(timestamp).toMatch(isoRegex);
      
      // Validate timestamp is parseable
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).getTime()).not.toBeNaN();
    });

    test('should have timestamp within reasonable range (not future, not too old)', () => {
      const lines = fileContent.trim().split('\n');
      const timestampLine = lines[1];
      const timestamp = timestampLine.replace('Timestamp: ', '');
      const fileDate = new Date(timestamp);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      expect(fileDate.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(fileDate.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
    });
  });

  describe('File Content Integrity', () => {
    test('should not contain unexpected characters or encoding issues', () => {
      const fileContent = fs.readFileSync(outputFilePath, 'utf8');
      
      // Should not contain null bytes
      expect(fileContent).not.toMatch(/\0/);
      
      // Should end with newline or not have trailing whitespace issues
      expect(fileContent).not.toMatch(/\s+$/);
      
      // Should not have unusual control characters
      expect(fileContent).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
    });

    test('should maintain consistent encoding (UTF-8)', () => {
      // Read as buffer to check for BOM or encoding issues
      const buffer = fs.readFileSync(outputFilePath);
      
      // Should not start with BOM
      expect(buffer[0]).not.toBe(0xEF);
      
      // Content should be valid UTF-8 when converted to string
      const content = buffer.toString('utf8');
      expect(content).toContain('Agent ID: test_agent');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('should handle file reading without memory issues', () => {
      // For a small file this is simple, but validates the approach
      expect(() => {
        const content = fs.readFileSync(outputFilePath, 'utf8');
        expect(typeof content).toBe('string');
      }).not.toThrow();
    });

    test('should validate against common file corruption patterns', () => {
      const fileContent = fs.readFileSync(outputFilePath, 'utf8');
      
      // Should not be empty
      expect(fileContent.trim().length).toBeGreaterThan(0);
      
      // Should not be binary data masquerading as text
      expect(fileContent).toMatch(/^[\x20-\x7E\n\r\t]+$/);
    });
  });
});

describe('File Creation Process Validation', () => {
  test('should demonstrate file can be recreated with same format', () => {
    const testContent = 'Agent ID: test_agent\nTimestamp: 2025-07-12T18:39:25.000Z';
    const tempFilePath = path.join(__dirname, 'temp-test-output.txt');
    
    // Create temp file
    fs.writeFileSync(tempFilePath, testContent);
    
    // Validate it matches expected format
    const content = fs.readFileSync(tempFilePath, 'utf8');
    expect(content).toMatch(/^Agent ID: test_agent$/m);
    expect(content).toMatch(/^Timestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/m);
    
    // Cleanup
    fs.unlinkSync(tempFilePath);
  });
});