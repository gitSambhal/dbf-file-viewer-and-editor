import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { DBFParser } from '../services/dbfParser';

// Mock all components to avoid rendering issues
vi.mock('../components/VirtualTable', () => ({
  default: () => <div data-testid="virtual-table">Virtual Table Mock</div>,
}));

vi.mock('../components/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar Mock</div>,
}));

vi.mock('../components/CustomModal', () => ({
  default: () => <div data-testid="custom-modal">Custom Modal Mock</div>,
}));

vi.mock('../components/ShortcutsHelp', () => ({
  default: () => <div data-testid="shortcuts-help">Shortcuts Help Mock</div>,
}));

declare global {
  interface Window {
    showOpenFilePicker?: any;
  }
}

// Mock the DBFParser
vi.mock('../services/dbfParser', () => ({
  DBFParser: {
    parse: vi.fn(),
    generateBlob: vi.fn(),
  },
}));

// Mock File API
global.File = class MockFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;

  constructor(bits: any[], filename: string, options: any = {}) {
    this.name = filename;
    this.size = bits.length;
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }

  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }
} as any;

// Mock URL
global.URL = {
  createObjectURL: vi.fn(() => 'mock-url'),
  revokeObjectURL: vi.fn(),
} as any;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock showOpenFilePicker
Object.defineProperty(window, 'showOpenFilePicker', {
  value: vi.fn(),
  writable: true,
});

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Initial Render', () => {
    it('renders the app with initial state', () => {
      render(<App />);

      expect(screen.getByText('DBF Nexus Professional')).toBeInTheDocument();
      expect(screen.getByText('SELECT DBF FILE')).toBeInTheDocument();
    });

    it('shows idle status initially', () => {
      render(<App />);

      expect(screen.getByText('Online DBF Viewer & Editor')).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('handles file upload via drag and drop', async () => {
      const mockDBFData = {
        id: 'test-id',
        fileName: 'test.dbf',
        header: {
          version: 0x03,
          lastUpdate: new Date(),
          numberOfRecords: 10,
          headerLength: 32,
          recordLength: 20,
          fields: [
            { name: 'FIELD1', type: 'C', length: 10, decimalCount: 0 },
          ],
        },
        rows: [
          { FIELD1: 'value1' },
          { FIELD1: 'value2' },
        ],
        hiddenColumns: [],
        changes: {},
      };

      (DBFParser.parse as any).mockResolvedValue(mockDBFData);

      render(<App />);

      const dropZone = screen.getByText('SELECT DBF FILE').closest('div');
      const file = new File([''], 'test.dbf', { type: 'application/octet-stream' });

      fireEvent.drop(dropZone!, {
        dataTransfer: {
          files: [file],
        },
      });

      await waitFor(() => {
        expect(DBFParser.parse).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'test.dbf');
      });
    });

    it('filters out non-DBF files', async () => {
      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([''], 'test.txt', { type: 'text/plain' });

      await userEvent.upload(fileInput, file);

      expect(DBFParser.parse).not.toHaveBeenCalled();
    });
  });

  describe('Export Functionality', () => {
    const mockDBFData = {
      id: 'test-id',
      fileName: 'test.dbf',
      header: {
        version: 0x03,
        lastUpdate: new Date(),
        numberOfRecords: 2,
        headerLength: 32,
        recordLength: 20,
        fields: [
          { name: 'NAME', type: 'C', length: 10, decimalCount: 0 },
          { name: 'AGE', type: 'N', length: 3, decimalCount: 0 },
        ],
      },
      rows: [
        { NAME: 'John', AGE: 25 },
        { NAME: 'Jane', AGE: 30 },
      ],
      hiddenColumns: [],
      changes: {},
    };

    beforeEach(() => {
      (DBFParser.parse as any).mockResolvedValue(mockDBFData);
      (DBFParser.generateBlob as any).mockReturnValue(new Blob());
    });

    it('exports data as DBF', async () => {
      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([''], 'test.dbf', { type: 'application/octet-stream' });

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export');
      await userEvent.click(exportButton);

      const dbfOption = screen.getByText('Original (.dbf)');
      await userEvent.click(dbfOption);

      expect(DBFParser.generateBlob).toHaveBeenCalledWith(mockDBFData);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('exports data as CSV', async () => {
      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([''], 'test.dbf', { type: 'application/octet-stream' });

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export');
      await userEvent.click(exportButton);

      const csvOption = screen.getByText('Spreadsheet (.csv)');
      await userEvent.click(csvOption);

      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    it('exports data as JSON', async () => {
      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([''], 'test.dbf', { type: 'application/octet-stream' });

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export');
      await userEvent.click(exportButton);

      const jsonOption = screen.getByText('Data (.json)');
      await userEvent.click(jsonOption);

      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });
  });

  describe('Theme Toggle', () => {
    it('toggles dark mode', async () => {
      render(<App />);

      const themeButton = screen.getByTitle('Switch to Dark Mode');
      await userEvent.click(themeButton);

      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('loads dark mode from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('dark');

      render(<App />);

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('opens file picker with Ctrl+O', async () => {
      render(<App />);

      fireEvent.keyDown(document, { key: 'o', ctrlKey: true });

      expect(window.showOpenFilePicker).toHaveBeenCalled();
    });

    it('shows info modal with ? key', async () => {
      render(<App />);

      fireEvent.keyDown(document, { key: '?' });

      expect(screen.getByText('About DBF Nexus')).toBeInTheDocument();
    });
  });

  describe('Column Management', () => {
    const mockDBFData = {
      id: 'test-id',
      fileName: 'test.dbf',
      header: {
        version: 0x03,
        lastUpdate: new Date(),
        numberOfRecords: 2,
        headerLength: 32,
        recordLength: 20,
        fields: [
          { name: 'NAME', type: 'C', length: 10, decimalCount: 0 },
          { name: 'AGE', type: 'N', length: 3, decimalCount: 0 },
          { name: 'CITY', type: 'C', length: 15, decimalCount: 0 },
        ],
      },
      rows: [
        { NAME: 'John', AGE: 25, CITY: 'NYC' },
        { NAME: 'Jane', AGE: 30, CITY: 'LA' },
      ],
      hiddenColumns: [],
      changes: {},
    };

    beforeEach(() => {
      (DBFParser.parse as any).mockResolvedValue(mockDBFData);
    });

    it('toggles column visibility', async () => {
      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([''], 'test.dbf', { type: 'application/octet-stream' });

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTitle('Manage Columns')).toBeInTheDocument();
      });

      const columnButton = screen.getByTitle('Manage Columns');
      await userEvent.click(columnButton);

      expect(screen.getByText('Layout Engine')).toBeInTheDocument();
    });
  });
});