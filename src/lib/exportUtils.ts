import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { parseLocalDate } from './utils';
import { MockScore } from '../types';

export const handleExportExcel = async (
  displayedMocks: MockScore[], 
  subjects: any[], 
  getSub: (mock: any, id: string) => any
) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Mock History');
  
  const dynamicCols = subjects.flatMap((s: any) => [
    { header: s.name, key: `sub_${s.id}`, width: 12 },
    { header: `${s.name} %ile`, key: `sub_perc_${s.id}`, width: 14 }
  ]);
  
  sheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Exam', key: 'exam', width: 25 },
    { header: 'Platform', key: 'platform', width: 15 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Percentile', key: 'percentile', width: 12 },
    ...dynamicCols
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600

  displayedMocks.forEach(mock => {
    const mockDate = parseLocalDate(mock.date);
    const rowData: any = {
      date: mockDate.toLocaleDateString(),
      exam: mock.mockName || `${mock.examType} ${mock.examRole} ${mock.examPhase}`,
      platform: mock.platform,
      score: mock.score,
      percentile: mock.percentile,
    };
    subjects.forEach((s: any) => {
      const sub = getSub(mock, s.id);
      rowData[`sub_${s.id}`] = sub?.score ?? '-';
      rowData[`sub_perc_${s.id}`] = sub?.percentile ?? '-';
    });
    const row = sheet.addRow(rowData);

    // Color coding percentile
    const pCell = row.getCell('percentile');
    if (mock.percentile >= 95) pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // emerald-500
    else if (mock.percentile >= 90) pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34D399' } }; // emerald-400
    else if (mock.percentile >= 80) pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // emerald-100
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  saveAs(new Blob([buffer]), `mock_history_${nowStr}.xlsx`);
};
