// src/lib/__tests__/printer-encoding.test.ts

import { describe, it, expect } from 'vitest';
import { 
  generateClientTicketEscPos, 
  generateKitchenOrderEscPos,
  generateBothEscPos 
} from '../printer-formats';
import type { CartItem } from '@/types/pos';

describe('Encoding CP850 en tickets', () => {
  
  // ✅ Mover mockItems DENTRO del describe para que sea accesible
  const mockItems: CartItem[] = [
    {
      quantity: 1,
      product: { name: "Pérez y Ñandú" },
      productSize: { name: "Mediana" },
      subtotal: 128,
      customLabel: "ÁÉÍÓÚ áéíóú Ññ Üü ¿¡ €",
      kitchenNote: "Bien cocido",
      customizations: [
        { ingredient: { name: "jalapeño" } },
        { ingredient: { name: "aguacate" } }
      ]
    }
  ];

  it('debe incluir ESC @ (0x1B 0x40) al inicio de cada ticket', () => {
    const clientTicket = generateClientTicketEscPos(
      mockItems, 128, 159, "Cliente", "27/02/2026", "Efectivo"
    );
    
    expect(clientTicket[0]).toBe(0x1B);
    expect(clientTicket[1]).toBe(0x40);
    
    const kitchenTicket = generateKitchenOrderEscPos(
      mockItems, 159, "César", "27/02/2026"
    );
    
    expect(kitchenTicket[0]).toBe(0x1B);
    expect(kitchenTicket[1]).toBe(0x40);
  });

  it('debe incluir ESC t 2 (0x1B 0x74 0x02) después del RESET', () => {
    const clientTicket = generateClientTicketEscPos(
      mockItems, 128, 159, "Cliente", "27/02/2026", "Efectivo"
    );
    
    // Verificar que los bytes 2-4 son ESC t 2
    expect(clientTicket[2]).toBe(0x1B);
    expect(clientTicket[3]).toBe(0x74);
    expect(clientTicket[4]).toBe(0x02);
    
    const kitchenTicket = generateKitchenOrderEscPos(
      mockItems, 159, "César", "27/02/2026"
    );
    
    expect(kitchenTicket[2]).toBe(0x1B);
    expect(kitchenTicket[3]).toBe(0x74);
    expect(kitchenTicket[4]).toBe(0x02);
  });

  it('debe convertir caracteres acentuados a CP850 correctamente', () => {
    const ticket = generateClientTicketEscPos(
      mockItems, 128, 159, "Cliente", "27/02/2026", "Efectivo"
    );
    
    // Verificar que NO hay bytes UTF-8
    const hasUtf8Bytes = ticket.some(b => b === 0xC3 || b === 0xC2 || b === 0xE2);
    expect(hasUtf8Bytes).toBe(false);
    
    // Verificar que los acentos específicos están presentes
    const cp850Bytes = [0xB5, 0x90, 0xD6, 0xE0, 0xE9, 0xA0, 0x82, 0xA1, 0xA2, 0xA3, 0xA5, 0xA4, 0x9A, 0x81, 0xA8, 0xAD, 0xD5];
    const foundAll = cp850Bytes.every(byte => ticket.includes(byte));
    expect(foundAll).toBe(true);
  });

  it('debe manejar correctamente los cortes completos', () => {
    const both = generateBothEscPos(
      mockItems, 128, 159, "Cliente Test", "27/02/2026", "Efectivo"
    );
    
    let cutCount = 0;
    for (let i = 0; i < both.length - 2; i++) {
      if (both[i] === 0x1D && both[i+1] === 0x56 && both[i+2] === 0x00) {
        cutCount++;
      }
    }
    
    expect(cutCount).toBe(2);
  });

  it('debe mantener los saltos de línea como LF (0x0A)', () => {
    const ticket = generateClientTicketEscPos(
      mockItems, 128, 159, "Cliente", "27/02/2026", "Efectivo"
    );
    
    const hasCR = ticket.some(b => b === 0x0D);
    expect(hasCR).toBe(false);
    
    const hasLF = ticket.some(b => b === 0x0A);
    expect(hasLF).toBe(true);
  });

  it('debe reemplazar caracteres no soportados por espacio', () => {
    const itemsConEmojis: CartItem[] = [{
      ...mockItems[0],
      customLabel: "😊 🌟 ❤️"
    }];
    
    const ticket = generateClientTicketEscPos(
      itemsConEmojis, 128, 159, "Cliente", "27/02/2026", "Efectivo"
    );
    
    const ticketString = ticket.map(b => String.fromCharCode(b)).join('');
    expect(ticketString).not.toContain('😊');
    expect(ticketString).not.toContain('🌟');
    expect(ticketString).not.toContain('❤️');
  });
});

describe('Validación de bytes específicos CP850', () => {
  // ✅ Mover mockItems también aquí
  const mockItems: CartItem[] = [{
    quantity: 1,
    product: { name: "Test" },
    subtotal: 128,
    customLabel: "",
    customizations: []
  }];

  const cp850Map = [
    { char: 'á', expected: 0xA0 },
    { char: 'é', expected: 0x82 },
    { char: 'í', expected: 0xA1 },
    { char: 'ó', expected: 0xA2 },
    { char: 'ú', expected: 0xA3 },
    { char: 'ñ', expected: 0xA4 },
    { char: 'Ñ', expected: 0xA5 },
    { char: 'ü', expected: 0x81 },
    { char: 'Ü', expected: 0x9A },
    { char: '¿', expected: 0xA8 },
    { char: '¡', expected: 0xAD },
    { char: '€', expected: 0xD5 }
  ];

  cp850Map.forEach(({ char, expected }) => {
    it(`debe convertir '${char}' a 0x${expected.toString(16)}`, () => {
      const items: CartItem[] = [{
        ...mockItems[0],
        customLabel: char
      }];
      
      const ticket = generateClientTicketEscPos(
        items, 128, 159, "Cliente", "27/02/2026", "Efectivo"
      );
      
      // Buscar el byte esperado en el ticket
      const found = ticket.includes(expected);
      expect(found).toBe(true);
      
      // Verificar que no hay bytes UTF-8
      const hasUtf8 = ticket.some(b => b === 0xC3 || b === 0xC2 || b === 0xE2);
      expect(hasUtf8).toBe(false);
    });
  });
});