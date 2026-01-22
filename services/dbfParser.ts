
import { DBFHeader, DBFField, DBFRow, DBFData } from '../types';

export class DBFParser {
  static async parse(buffer: ArrayBuffer, fileName: string): Promise<DBFData> {
    const view = new DataView(buffer);
    const decoder = new TextDecoder('windows-1252');

    // 1. Parse Header
    const version = view.getUint8(0);
    const yearRaw = view.getUint8(1);
    const year = yearRaw < 70 ? 2000 + yearRaw : (yearRaw < 100 ? 1900 + yearRaw : 1900 + yearRaw);
    const month = view.getUint8(2) - 1;
    const day = view.getUint8(3);
    const lastUpdate = new Date(year, month, day);
    const numberOfRecords = view.getUint32(4, true);
    const headerLength = view.getUint16(8, true);
    const recordLength = view.getUint16(10, true);

    // 2. Parse Fields
    const fields: DBFField[] = [];
    let offset = 32;
    while (offset < headerLength - 1 && view.getUint8(offset) !== 0x0D) {
      const nameBytes = new Uint8Array(buffer.slice(offset, offset + 11));
      let name = decoder.decode(nameBytes).split('\0')[0].trim();
      const type = String.fromCharCode(view.getUint8(offset + 11)).toUpperCase();
      const length = view.getUint8(offset + 16);
      const decimalCount = view.getUint8(offset + 17);
      
      fields.push({ name, type, length, decimalCount });
      offset += 32;
    }

    const header: DBFHeader = {
      version,
      lastUpdate,
      numberOfRecords,
      headerLength,
      recordLength,
      fields
    };

    // 3. Parse Records
    const rows: DBFRow[] = [];
    let recordOffset = headerLength;

    for (let i = 0; i < numberOfRecords; i++) {
      if (recordOffset + recordLength > buffer.byteLength) break;
      
      const statusByte = view.getUint8(recordOffset);
      const isDeleted = statusByte === 0x2A; 
      
      if (!isDeleted) {
        const row: DBFRow = {};
        let fieldOffset = recordOffset + 1;
        
        for (const field of fields) {
          let value: any;

          // Binary Types (Visual FoxPro / newer dBase)
          // We use direct view access with offsets for better reliability
          if (field.type === 'I') {
            value = field.length >= 4 ? view.getInt32(fieldOffset, true) : 0;
          } else if (field.type === 'B') {
            value = field.length >= 8 ? view.getFloat64(fieldOffset, true) : 0;
          } else if (field.type === 'T') {
            // DateTime - 8 bytes binary (Julian Day + Milliseconds)
            if (field.length >= 8) {
              const julianDay = view.getInt32(fieldOffset, true);
              const ms = view.getInt32(fieldOffset + 4, true);
              if (julianDay === 0) {
                value = null;
              } else {
                // Julian Day 2440588 is Jan 1, 1970 (Unix Epoch)
                const unixMs = (julianDay - 2440588) * 86400000 + ms;
                const d = new Date(unixMs);
                if (isNaN(d.getTime())) {
                  value = "[Invalid Date]";
                } else {
                  value = d.toISOString().replace('T', ' ').split('.')[0];
                }
              }
            } else {
              value = null;
            }
          } else if (field.type === 'Y') {
            // Currency - 8 bytes binary integer (implied 4 decimals)
            if (field.length >= 8) {
              const rawInt = view.getBigInt64(fieldOffset, true);
              value = Number(rawInt) / 10000;
            } else {
              value = 0;
            }
          } else {
            // Text-based Types
            const fieldBytes = new Uint8Array(buffer, fieldOffset, field.length);
            const valueRaw = decoder.decode(fieldBytes).trim();
            value = valueRaw;
            
            if (field.type === 'N' || field.type === 'F') {
              const parsed = parseFloat(valueRaw.replace(/,/g, ''));
              value = isNaN(parsed) ? (valueRaw === '' ? 0 : valueRaw) : parsed;
            } else if (field.type === 'L') {
              value = ['Y', 'y', 'T', 't'].includes(valueRaw);
            } else if (field.type === 'D') {
              const cleanDate = valueRaw.replace(/\D/g, '');
              if (cleanDate.length === 8) {
                const y = parseInt(cleanDate.substring(0, 4));
                const m = parseInt(cleanDate.substring(4, 6)) - 1;
                const d = parseInt(cleanDate.substring(6, 8));
                const dateObj = new Date(y, m, d);
                if (!isNaN(dateObj.getTime())) {
                  value = dateObj.toISOString().split('T')[0];
                }
              }
            } else if (field.type === 'M') {
              value = valueRaw ? `[Memo Pointer: ${valueRaw}]` : '';
            }
          }
          
          row[field.name] = value;
          fieldOffset += field.length;
        }
        rows.push(row);
      }
      recordOffset += recordLength;
    }

    return { 
      id: Math.random().toString(36).substr(2, 9),
      header, 
      rows, 
      fileName, 
      hiddenColumns: [] 
    };
  }

  static generateBlob(data: DBFData): Blob {
    const { header, rows } = data;
    const encoder = new TextEncoder();
    
    let calculatedRecordLength = 1; 
    header.fields.forEach(f => calculatedRecordLength += f.length);

    const bufferSize = header.headerLength + (rows.length * calculatedRecordLength) + 1;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    view.setUint8(0, header.version);
    const now = new Date();
    view.setUint8(1, now.getFullYear() - 1900);
    view.setUint8(2, now.getMonth() + 1);
    view.setUint8(3, now.getDate());
    view.setUint32(4, rows.length, true);
    view.setUint16(8, header.headerLength, true);
    view.setUint16(10, calculatedRecordLength, true);

    let offset = 32;
    header.fields.forEach(field => {
      const nameEncoded = encoder.encode(field.name.padEnd(11, '\0'));
      uint8.set(nameEncoded.subarray(0, 11), offset);
      view.setUint8(offset + 11, field.type.charCodeAt(0));
      view.setUint8(offset + 16, field.length);
      view.setUint8(offset + 17, field.decimalCount);
      offset += 32;
    });
    view.setUint8(header.headerLength - 1, 0x0D);

    let recordOffset = header.headerLength;
    rows.forEach(row => {
      view.setUint8(recordOffset, 0x20); 
      let fieldOffset = recordOffset + 1;
      
      header.fields.forEach(field => {
        let val = row[field.name] ?? '';
        
        if (field.type === 'I') {
          view.setInt32(fieldOffset, Number(val) || 0, true);
        } else if (field.type === 'B') {
          view.setFloat64(fieldOffset, Number(val) || 0, true);
        } else if (field.type === 'T') {
          if (val && !isNaN(new Date(val).getTime())) {
            const date = new Date(val);
            const unixMs = date.getTime();
            const julianDay = Math.floor(unixMs / 86400000) + 2440588;
            const msFromMidnight = unixMs % 86400000;
            view.setInt32(fieldOffset, julianDay, true);
            view.setInt32(fieldOffset + 4, msFromMidnight, true);
          } else {
            view.setInt32(fieldOffset, 0, true);
            view.setInt32(fieldOffset + 4, 0, true);
          }
        } else if (field.type === 'Y') {
          const rawInt = BigInt(Math.round(Number(val) * 10000));
          view.setBigInt64(fieldOffset, rawInt, true);
        } else {
          let strVal = '';
          if (field.type === 'N' || field.type === 'F') {
            const num = typeof val === 'number' ? val : parseFloat(val);
            strVal = (isNaN(num) ? 0 : num).toFixed(field.decimalCount).toString().padStart(field.length, ' ');
          } else if (field.type === 'D') {
            strVal = (val as string).replace(/-/g, '').padEnd(field.length, ' ');
          } else if (field.type === 'L') {
            strVal = val ? 'T' : 'F';
          } else {
            strVal = val.toString().padEnd(field.length, ' ');
          }

          const encodedVal = encoder.encode(strVal.substring(0, field.length));
          uint8.set(encodedVal, fieldOffset);
        }
        fieldOffset += field.length;
      });
      recordOffset += calculatedRecordLength;
    });

    view.setUint8(bufferSize - 1, 0x1A); 

    return new Blob([buffer], { type: 'application/octet-stream' });
  }
}
