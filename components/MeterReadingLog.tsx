
import React, { useState, useEffect, useMemo } from 'react';
import { MeterReadingData, MeterReadingItem, Tenant, MeterPhotoItem, StaffMember } from '../types';
import { fetchMeterReading, saveMeterReading, getInitialMeterReading, fetchTenants, fetchMeterPhotos, fetchStaffList } from '../services/dataService';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { Save, Printer, Plus, Trash2, RefreshCw, CheckCircle2, X, Cloud, FileText, ChevronLeft, ChevronRight, Calculator, Download, Building2, Edit2, Lock } from 'lucide-react';

interface MeterReadingLogProps {
  currentDate: Date;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatNumber = (val: string | number | undefined) => {
  if (val === undefined || val === null || val === '') return '';
  const str = val.toString().replace(/,/g, '');
  if (str === '.') return '.';
  const parts = str.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  const formattedInteger = integerPart === '' ? '' : (integerPart === '-' ? '-' : Number(integerPart).toLocaleString());
  if (str.includes('.')) {
    return formattedInteger + '.' + (decimalPart !== undefined ? decimalPart.substring(0, 2) : '');
  }
  return formattedInteger;
};

const unformatNumber = (val: string) => val.replace(/,/g, '');

const MeterReadingLog: React.FC<MeterReadingLogProps> = ({ currentDate }) => {
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [data, setData] = useState<MeterReadingData>(getInitialMeterReading(format(currentDate, 'yyyy-MM')));

  useEffect(() => {
    loadData(currentMonth);
  }, [currentMonth]);

  const loadData = async (monthStr: string) => {
    setLoading(true);
    setIsEditMode(false);
    try {
      const fetched = await fetchMeterReading(monthStr);
      if (fetched && fetched.items && fetched.items.length > 0) {
        setData(fetched);
      } else {
        const prevMonthDate = subMonths(parseISO(`${monthStr}-01`), 1);
        const prevMonthStr = format(prevMonthDate, 'yyyy-MM');
        const prevData = await fetchMeterReading(prevMonthStr);
        if (prevData && prevData.items && prevData.items.length > 0) {
          const carriedItems: MeterReadingItem[] = prevData.items.map(item => ({
            id: generateId(),
            floor: item.floor,
            tenant: item.tenant,
            area: item.area,
            refPower: item.refPower || '2380',
            multiplier: item.multiplier,
            note: item.note,
            prevReading: item.currentReading,
            currentReading: ''
          }));
          setData({ 
            month: monthStr, 
            unitPrice: prevData.unitPrice || '228',
            totalBillInput: prevData.totalBillInput || '',
            totalUsageInput: prevData.totalUsageInput || '',
            items: carriedItems 
          });
        } else {
          setData({ ...getInitialMeterReading(monthStr), unitPrice: '228', items: [] });
        }
      }
    } catch (e) {
      console.error(e);
      setData({ ...getInitialMeterReading(monthStr), unitPrice: '228' });
    } finally {
      setLoading(false);
    }
  }

  const handlePrevMonth = () => setCurrentMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));
  const handleNextMonth = () => setCurrentMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));

  const handleSave = async () => {
    if (!data) return;
    setShowConfirm(false);
    setSaveStatus('loading');
    try {
      const success = await saveMeterReading(data);
      if (success) {
        setSaveStatus('success');
        setIsEditMode(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (error) { setSaveStatus('error'); }
  };

  const updateItemField = (id: string, field: keyof MeterReadingItem, value: string) => {
    const unformatted = unformatNumber(value);
    setData(prev => ({
      ...prev,
      items: prev.items.map(it => it.id === id ? { ...it, [field]: unformatted } : it)
    }));
  };

  const getCalculations = (item: MeterReadingItem) => {
    const prev = parseFloat((item.prevReading || '0').toString().replace(/,/g, ''));
    const curr = parseFloat((item.currentReading || '0').toString().replace(/,/g, ''));
    const mult = parseFloat((item.multiplier || '1').toString().replace(/,/g, ''));
    let diff = 0;
    if (curr < prev) {
      const rolloverBase = prev < 100000 ? 100000 : 1000000;
      diff = (rolloverBase + curr) - prev;
    } else { diff = curr - prev; }
    const usage = Math.round(diff * mult);
    const ref = parseFloat((item.refPower || '0').toString().replace(/,/g, ''));
    const unitPrice = parseFloat((data.unitPrice || '0').toString().replace(/,/g, ''));
    const billableUsage = item.note === '특수' ? usage : usage - ref;
    const bill = Math.round(billableUsage * unitPrice);
    const excess = item.note === '특수' ? null : usage - ref;
    return { diff, usage, bill, excess };
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, MeterReadingItem[]> = {};
    data.items.forEach(it => {
      const key = `${it.tenant}_${it.floor}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    });
    return groups;
  }, [data.items]);

  const totalCalculatedBill = useMemo(() => {
    return data.items.reduce((sum, it) => {
      const bill = getCalculations(it).bill;
      return sum + (bill > 0 ? bill : 0);
    }, 0);
  }, [data.items, data.unitPrice]);

  const totalCalculatedUsage = useMemo(() => data.items.reduce((sum, it) => sum + getCalculations(it).usage, 0), [data.items]);
  const totalArea = useMemo(() => Object.keys(groupedItems).reduce((sum, key) => sum + (parseFloat(groupedItems[key][0]?.area?.toString().replace(/,/g, '') || '0') || 0), 0), [groupedItems]);

  const handleSummaryChange = (field: 'totalBillInput' | 'totalUsageInput', value: string) => {
    const unformatted = unformatNumber(value);
    const bill = field === 'totalBillInput' ? parseFloat(unformatted) : parseFloat(data.totalBillInput || totalCalculatedBill.toString());
    const usage = field === 'totalUsageInput' ? parseFloat(unformatted) : parseFloat(data.totalUsageInput || totalCalculatedUsage.toString());
    let nextPrice = data.unitPrice;
    if (!isNaN(bill) && !isNaN(usage) && usage > 0) nextPrice = Math.round(bill / usage).toString();
    setData({ ...data, [field]: unformatted, unitPrice: nextPrice });
  };

  const handlePrintMain = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;
    const [y, m] = currentMonth.split('-');
    const title = `${y}년 ${parseInt(m)}월 층별 계량기 검침내역`;
    let tableRowsHtml = '';
    Object.keys(groupedItems).forEach(groupKey => {
      const items = groupedItems[groupKey];
      items.forEach((item, idx) => {
        const { diff, usage, bill, excess } = getCalculations(item);
        tableRowsHtml += `
          <tr>
            ${idx === 0 ? `<td rowspan="${items.length}" style="text-align:left; padding-left:10px; font-weight:bold;">${item.tenant}</td>` : ''}
            ${idx === 0 ? `<td rowspan="${items.length}">${item.floor}</td>` : ''}
            ${idx === 0 ? `<td rowspan="${items.length}">${formatNumber(item.area)}</td>` : ''}
            ${idx === 0 ? `<td rowspan="${items.length}" style="color:#059669; font-weight:bold;">${formatNumber(item.refPower)}</td>` : ''}
            <td style="text-align:right; padding-right:8px; color:blue;">${bill.toLocaleString()}</td>
            <td style="color:#f97316; font-weight:bold;">${formatNumber(item.currentReading)}</td>
            <td>${formatNumber(item.prevReading)}</td>
            <td style="color:#64748b;">${diff.toLocaleString()}</td>
            <td style="font-weight:bold;">${usage.toLocaleString()}</td>
            <td style="color:${excess !== null && excess > 0 ? 'red' : '#059669'}; font-weight:bold;">${excess !== null ? excess.toLocaleString() : ''}</td>
            <td style="font-size:7pt;">${item.note}</td>
          </tr>
        `;
      });
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: black; line-height: 1.2; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } }
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 10mm 10mm 10mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            @media print { .print-page { box-shadow: none !important; margin: 0; width: 100%; } }
            .flex-header { display: flex; justify-content: center; align-items: center; margin-bottom: 25px; min-height: 60px; width: 100%; }
            .title-area { flex: 1; text-align: center; }
            .doc-title { font-size: 24pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin: 0; }
            table.main-table { width: 100%; border-collapse: collapse; border: 1.5px solid black; }
            table.main-table th, table.main-table td { border: 1px solid black; padding: 0 2px; text-align: center; font-size: 8.5pt; height: 20px; }
            table.main-table th { background: #f3f4f6; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="flex-header">
              <div class="title-area"><h1 class="doc-title">${y}년 ${parseInt(m)}월 계량기 검침내역</h1></div>
            </div>
            <table class="main-table">
              <thead>
                <tr>
                  <th style="width:125px;">입주사명</th><th style="width:35px;">층</th><th style="width:45px;">면적</th><th style="width:55px;">기준전력</th>
                  <th style="width:65px;">전기요금</th><th style="width:70px;">당월지침</th><th style="width:70px;">전월지침</th>
                  <th style="width:45px;">지침차</th><th style="width:55px;">사용량</th><th style="width:55px;">초과전력</th><th style="width:30px;">비고</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
                <tr style="background:#f9fafb; font-weight:bold; height:20px;">
                  <td colspan="2">합 계</td><td>${totalArea.toLocaleString()}</td><td></td>
                  <td style="text-align:right; padding-right:8px; color:blue;">${totalCalculatedBill.toLocaleString()}</td>
                  <td colspan="3"></td>
                  <td style="color:#f97316;">${totalCalculatedUsage.toLocaleString()}</td>
                  <td colspan="2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintInvoiceSummary = async () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const staffList = await fetchStaffList();
    const manager = staffList.find(s => s.jobTitle && s.jobTitle.includes('소장'));
    const managerName = manager ? manager.name : '';
    const managerPhoto = manager ? manager.photo : '';

    const [y, m] = currentMonth.split('-');
    const title = `${y}년 ${parseInt(m)}월 대치사옥 추가전기요금 총괄표(계산서발행)`;
    const formatValue = (val: number) => val === 0 ? '-' : val.toLocaleString();
    const invoiceData = Object.keys(groupedItems).map((key, idx) => {
      const items = groupedItems[key];
      const subtotal = items.reduce((sum, it) => {
        const b = getCalculations(it).bill;
        return sum + (b > 0 ? b : 0);
      }, 0);
      const supplyValue = Math.round(subtotal / 1.1);
      const tax = subtotal - supplyValue;
      return { index: idx + 1, floor: items[0].floor, tenant: items[0].tenant, subtotal, supplyValue, tax };
    });
    const grandSubtotal = invoiceData.reduce((sum, d) => sum + d.subtotal, 0);
    const grandSupply = invoiceData.reduce((sum, d) => sum + d.supplyValue, 0);
    const grandTax = invoiceData.reduce((sum, d) => sum + d.tax, 0);
    const tableRows = invoiceData.map(d => `<tr><td>${d.index}</td><td>${d.floor}</td><td style="text-align:left; padding-left:15px;">${d.tenant}</td><td style="text-align:right; padding-right:15px;">${formatValue(d.subtotal)}</td><td style="text-align:right; padding-right:15px;">${formatValue(d.supplyValue)}</td><td style="text-align:right; padding-right:15px;">${formatValue(d.tax)}</td><td></td></tr>`).join('');
    
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
      @page { size: A4 portrait; margin: 0; }
      body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: black; line-height: 1.2; -webkit-print-color-adjust: exact; }
      .no-print { display: flex; justify-content: center; padding: 20px; background: #f1f5f9; border-bottom: 1px solid #ddd; }
      @media print { .no-print { display: none !important; } body { background: white !important; } .container { box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 15mm !important; } }
      .container { width: 210mm; min-height: 297mm; margin: 20px auto; background: white; padding: 20mm 15mm; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); box-sizing: border-box; }
      h1 { text-align: center; font-size: 20px; font-weight: 900; margin-bottom: 5px; }
      .unit-label { text-align: right; font-size: 9pt; font-weight: bold; margin-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; }
      th, td { border: 1px solid black; padding: 4px; font-size: 9.5pt; text-align: center; height: 25px; }
      thead th { background-color: #f8fafc; font-weight: bold; }
      .bg-purple { background-color: #e0e7ff !important; }
      .font-bold { font-weight: bold; }
      .footer { margin-top: 50px; display: flex; justify-content: center; font-weight: 900; font-size: 14pt; gap: 60px; align-items: center; }
      .sign-wrapper { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 40px; }
      .sign-text { z-index: 1; position: relative; }
      .seal-img { position: absolute; width: 45px; height: 45px; object-fit: contain; z-index: 2; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.8; }
    </style></head><body><div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">인쇄하기</button></div><div class="container"><h1>${title}</h1><div class="unit-label">(단위 : 원)</div><table><thead><tr><th rowspan="2" style="width:7%;">연번</th><th rowspan="2" style="width:10%;">층</th><th rowspan="2" style="width:25%;">업 체 명</th><th colspan="3">추가전기요금</th><th rowspan="2" style="width:15%;">비고</th></tr><tr><th style="width:15%;">소 계</th><th style="width:15%;">공급가액</th><th style="width:13%;">세 액</th></tr></thead><tbody><tr class="font-bold"><td colspan="3">계</td><td style="text-align:right; padding-right:15px;">${formatValue(grandSubtotal)}</td><td style="text-align:right; padding-right:15px;">${formatValue(grandSupply)}</td><td style="text-align:right; padding-right:15px;">${formatValue(grandTax)}</td><td></td></tr><tr class="bg-purple font-bold"><td colspan="3">소계[세금계산서 청구]</td><td style="text-align:right; padding-right:15px;">${formatValue(grandSubtotal)}</td><td style="text-align:right; padding-right:15px;">${formatValue(grandSupply)}</td><td style="text-align:right; padding-right:15px;">${formatValue(grandTax)}</td><td></td></tr>${tableRows}</tbody></table><div class="footer"><span>관리소장 : ${managerName}</span><div class="sign-wrapper"><span class="sign-text">(인)</span>${managerPhoto ? `<img src="${managerPhoto}" class="seal-img" />` : ''}</div></div></div></body></html>`);
    printWindow.document.close();
  };

  const generateTenantBillHtml = (tenantName: string, floor: string, isLast: boolean, photos: MeterPhotoItem[]) => {
    const tenantItems = data.items.filter(it => it.tenant === tenantName && it.floor === floor);
    const normalItem = tenantItems.find(it => it.note === '일반');
    const specialItem = tenantItems.find(it => it.note === '특수');
    const [y, m] = currentMonth.split('-');
    const prevMonthDate = subMonths(parseISO(`${currentMonth}-01`), 1);
    const py = format(prevMonthDate, 'yyyy');
    const pm = format(prevMonthDate, 'MM');
    const periodStr = `${py}년 ${pm}월 17일 ~ ${y}년 ${m}월 16일`;
    const todayStr = format(new Date(), 'yyyy년 MM월 dd일');
    const unitPrice = data.unitPrice || '228';
    const normalCalc = normalItem ? getCalculations(normalItem) : { usage: 0, bill: 0 };
    const specialCalc = specialItem ? getCalculations(specialItem) : { usage: 0, bill: 0 };
    const totalBill = (normalCalc.bill > 0 ? normalCalc.bill : 0) + (specialCalc.bill > 0 ? specialCalc.bill : 0);

    const normalPhoto = photos.find(p => p.tenant === tenantName && p.floor === floor && p.type === '일반');
    const specialPhoto = photos.find(p => p.tenant === tenantName && p.floor === floor && p.type === '특수');

    let photosHtml = '';
    if (normalPhoto || specialPhoto) {
      photosHtml = `<div class="photo-evidence-container">`;
      if (normalPhoto) {
        photosHtml += `<div class="photo-item"><img src="${normalPhoto.photo}" /><div class="photo-label">[ 일반 지침 사진 ]</div></div>`;
      }
      if (specialPhoto) {
        photosHtml += `<div class="photo-item"><img src="${specialPhoto.photo}" /><div class="photo-label">[ 특수 지침 사진 ]</div></div>`;
      }
      photosHtml += `</div>`;
    }

    // 로고 이미지 URL을 가장 안정적인 위키미디어 공용 이미지로 교체
    const saemaulLogoUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Saemaul_Undong_logo.svg/1024px-Saemaul_Undong_logo.svg.png";

    return `
      <div class="bill-page ${!isLast ? 'page-break' : ''}">
        <div class="bill-container">
          <h1 class="header-title">입주사 전기요금 사용내역서(${parseInt(m)}월)</h1>
          <div class="write-date">작성일 : ${todayStr}</div>
          <table>
            <tr class="tenant-title-row"><th colspan="4">${tenantName} ( ${floor} )</th></tr>
            <tr><th class="label-cell">사용기간</th><td colspan="3">${periodStr}</td></tr>
            <tr><th class="label-cell" rowspan="2">계량기검침</th><td colspan="1" style="width:35%; font-weight:bold; background:#f9f9f9;">당월지침</td><td colspan="2" style="font-weight:bold; background:#f9f9f9;">전월지침</td></tr>
            <tr><td colspan="1" class="bold-text">${formatNumber(normalItem?.currentReading) || '-'}</td><td colspan="2" class="bold-text">${formatNumber(normalItem?.prevReading) || '-'}</td></tr>
            <tr><th class="label-cell">전력 사용량</th><td colspan="3"><span class="bold-text" style="font-size:14pt;">${normalCalc.usage.toLocaleString()}</span> - (KWH)</td></tr>
            <tr><th class="label-cell">kWh당 단가</th><td colspan="3">￦ ${parseInt(unitPrice).toLocaleString()} 원</td></tr>
            <tr><th class="label-cell">기준전력(KWH)</th><td colspan="3">${formatNumber(normalItem?.refPower) || '2,380'} - (KWH)</td></tr>
            <tr><th class="label-cell">전기요금</th><td colspan="3" class="formula-cell">(사용량 ${normalCalc.usage.toLocaleString()} - 기준 ${formatNumber(normalItem?.refPower) || '2,380'}) X ${parseInt(unitPrice).toLocaleString()} = <span class="bold-text" style="font-size:14pt;">￦ ${normalCalc.bill.toLocaleString()} 원</span></td></tr>
            <tr class="sub-header"><th colspan="4">특수 전력 사용요금(에어컨, 전열)</th></tr>
            <tr><th class="label-cell" rowspan="2">계량기 검침</th><td colspan="1" style="font-weight:bold; background:#f9f9f9;">당월지침</td><td colspan="2" style="font-weight:bold; background:#f9f9f9;">전월지침</td></tr>
            <tr><td colspan="1" class="bold-text">${formatNumber(specialItem?.currentReading) || '-'}</td><td colspan="2" class="bold-text">${formatNumber(specialItem?.prevReading) || '-'}</td></tr>
            <tr><th class="label-cell">전력 사용량</th><td colspan="3"><span class="bold-text" style="font-size:14pt;">${specialCalc.usage.toLocaleString()}</span> - (KWH)</td></tr>
            <tr><th class="label-cell">kWh당 단가</th><td colspan="3">￦ ${parseInt(unitPrice).toLocaleString()} 원</td></tr>
            <tr><th class="label-cell">전기요금</th><td colspan="3" class="formula-cell">${specialCalc.usage.toLocaleString()} X ${parseInt(unitPrice).toLocaleString()} = <span class="bold-text" style="font-size:14pt;">￦ ${specialCalc.bill.toLocaleString()} 원</span></td></tr>
            <tr class="total-row"><th class="total-label">청구 요금</th><td colspan="3" class="bold-text" style="font-size:24pt;">￦ ${totalBill.toLocaleString()} 원</td></tr>
          </table>
          ${photosHtml}
          <div class="footer-info">입금계좌안내 : 우리은행 1006-401-220508 (새마을운동중앙회)</div>
          <div class="footer-logo">
            <img src="${saemaulLogoUrl}" class="logo-img" />
          </div>
        </div>
      </div>`;
  };

  const billStyles = `<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
    @page { size: A4 portrait; margin: 0; }
    body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: black; line-height: 1.4; -webkit-print-color-adjust: exact; }
    .no-print { display: flex; justify-content: center; padding: 20px; background: #f1f5f9; border-bottom: 1px solid #ddd; }
    @media print { .no-print { display: none !important; } body { background: white !important; } .page-break { page-break-after: always; } }
    .bill-page { width: 210mm; min-height: 297mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; padding: 15mm 15mm; }
    @media print { .bill-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 10mm 15mm; } }
    .bill-container { width: 100%; }
    .header-title { text-align: center; font-size: 32pt; font-weight: 900; margin-bottom: 10px; margin-top: 40px; letter-spacing: -1px; }
    .write-date { text-align: right; font-weight: bold; font-size: 13pt; margin-bottom: 25px; padding-right: 5px; }
    table { width: 100%; border-collapse: collapse; border: 1.2px solid black; table-layout: fixed; margin-bottom: 5px; }
    th, td { border: 1px solid black; padding: 2px 4px; font-size: 12.5pt; text-align: center; height: 30px; }
    .tenant-title-row { background-color: #dce6c1 !important; font-weight: 900; font-size: 16pt; height: 30px; }
    .label-cell { background-color: #ffffff; font-weight: bold; width: 30%; }
    .formula-cell { text-align: center; font-size: 11pt; }
    .bold-text { font-weight: 900; }
    .sub-header { background-color: #ffffff; font-weight: 900; font-size: 13pt; height: 30px; border-top: 2px solid black; }
    .total-row { height: 30px; font-size: 20pt; font-weight: 900; }
    .total-label { width: 30%; font-size: 18pt; background: #ffffff; }
    .photo-evidence-container { display: flex; justify-content: center; gap: 10mm; margin-top: 5mm; margin-bottom: 5mm; }
    .photo-item { text-align: center; width: 85mm; }
    .photo-item img { width: 100%; height: 40mm; object-fit: contain; border: 1px solid black; background: #fafafa; }
    .photo-label { font-size: 9pt; font-weight: bold; margin-top: 3px; }
    .footer-info { margin-top: 20px; font-weight: bold; font-size: 12pt; text-align: center; border-top: 1px solid #eee; padding-top: 15px; }
    .footer-logo { margin-top: 30px; display: flex; justify-content: center; align-items: center; width: 100%; }
    .logo-img { height: 65px; width: auto; object-fit: contain; }
  </style>`;

  const handlePrintTenantBill = async (tenantName: string, floor: string) => {
    const photosData = await fetchMeterPhotos(currentMonth);
    const photos = photosData?.items || [];
    const printWindow = window.open('', '_blank', 'width=900,height=950');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>전기요금 사용내역서 - ${tenantName}</title>${billStyles}</head><body><div class="no-print"><button onclick="window.print()" style="padding: 12px 30px; background: #1e3a8a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13pt;">인쇄하기</button></div>${generateTenantBillHtml(tenantName, floor, true, photos)}</body></html>`);
    printWindow.document.close();
  };

  const handlePrintAllTenantBills = async () => {
    const photosData = await fetchMeterPhotos(currentMonth);
    const photos = photosData?.items || [];
    const printWindow = window.open('', '_blank', 'width=1000,height=950');
    if (!printWindow) return;
    const groupKeys = Object.keys(groupedItems);
    const allBillsHtml = groupKeys.map((key, index) => {
      const [tenantName, floor] = key.split('_');
      return generateTenantBillHtml(tenantName, floor, index === groupKeys.length - 1, photos);
    }).join('');
    printWindow.document.write(`<html><head><title>전체 입주사 전기요금 사용내역서</title>${billStyles}</head><body><div class="no-print"><button onclick="window.print()" style="padding: 12px 30px; background: #1e3a8a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13pt;">전체 인쇄하기</button></div>${allBillsHtml}</body></html>`);
    printWindow.document.close();
  };

  const thClass = "border border-gray-300 p-2 bg-gray-50 text-center font-normal text-[12px] text-gray-600";
  const tdClass = "border border-gray-300 p-0 text-center text-[12px] align-middle h-11 relative";
  const inputClass = "w-full h-full text-center outline-none bg-transparent font-normal focus:bg-blue-50/50";

  return (
    <div className="pb-20">
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm print:hidden">
          <div className="flex items-center space-x-6 ml-2">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-600"><ChevronLeft size={24} /></button>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight min-w-[140px] text-center">{currentMonth.split('-')[0]}년 {currentMonth.split('-')[1]}월</h2>
            <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-600"><ChevronRight size={24} /></button>
          </div>
          <div className="flex items-center gap-2 pr-2">
            <button onClick={() => loadData(currentMonth)} disabled={loading} className="flex items-center px-4 py-2 bg-gray-50 text-gray-600 rounded-lg border border-gray-200 font-bold hover:bg-gray-100 transition-all text-sm shadow-sm active:scale-95"><RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />새로고침</button>
            
            <button 
              onClick={() => setIsEditMode(!isEditMode)} 
              className={`flex items-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-sm ${isEditMode ? 'bg-orange-50 text-white hover:bg-orange-600' : 'bg-gray-700 text-white hover:bg-gray-800'}`}
            >
              {isEditMode ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />}
              {isEditMode ? '수정 취소' : '수정'}
            </button>

            <button onClick={() => setShowConfirm(true)} disabled={saveStatus === 'loading'} className="flex items-center px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all text-sm shadow-md active:scale-95"><Save size={18} className="mr-2" />서버 저장</button>
            
            <button onClick={handlePrintMain} className="flex items-center px-4 py-2 bg-slate-700 text-white rounded-lg font-bold hover:bg-slate-800 transition-all text-sm shadow-md active:scale-95"><Printer size={18} className="mr-2" />미리보기</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-5xl mx-auto">
          <div className="bg-gray-50/50 py-3 text-center border-b font-bold text-gray-700">전기요금 청구서 요약</div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 border-b">
                <th className="py-2 border-r font-bold">전기요금(원)</th>
                <th className="py-2 border-r font-bold">사용량(kwh)</th>
                <th className="py-2 font-bold">kwh당 단가(원)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-center font-black">
                <td className="py-4 border-r"><input type="text" value={formatNumber(data.totalBillInput || totalCalculatedBill.toString())} onChange={e => handleSummaryChange('totalBillInput', e.target.value)} className="w-full text-center text-xl text-blue-600 font-black outline-none bg-transparent" /></td>
                <td className="py-4 border-r"><input type="text" value={formatNumber(data.totalUsageInput || totalCalculatedUsage.toString())} onChange={e => handleSummaryChange('totalUsageInput', e.target.value)} className="w-full text-center text-xl text-orange-500 font-black outline-none bg-transparent" /></td>
                <td className="py-4"><input type="text" value={formatNumber(data.unitPrice || '228')} readOnly className="w-full text-center text-xl text-gray-800 font-black outline-none bg-transparent cursor-not-allowed" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto px-1 gap-4 pt-4">
          <div className="flex-1"></div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter text-center">{data.month.split('-')[0]}년 {data.month.split('-')[1]}월 층별 계량기 검침내역</h2>
          <div className="flex-1 flex justify-end gap-2">
            <button onClick={handlePrintAllTenantBills} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"><Printer size={16} className="mr-1.5" />전체 출력</button>
            <button onClick={handlePrintInvoiceSummary} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center shadow-sm hover:bg-blue-700 active:scale-95 transition-all"><Calculator size={16} className="mr-1.5" />계산서발행</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-300 overflow-hidden max-w-7xl mx-auto">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed min-w-full">
              <thead><tr className="bg-gray-50"><th className={`${thClass} w-36`}>입주사명</th><th className={`${thClass} w-14`}>층 별</th><th className={`${thClass} w-18`}>전용면적</th><th className={`${thClass} w-18`}>기준전력(월)</th><th className={`${thClass} w-18`}>전기요금</th><th className={`${thClass} w-18`}>당월지침</th><th className={`${thClass} w-18`}>전월지침</th><th className={`${thClass} w-14`}>지침차</th><th className={`${thClass} w-18`}>사용량(kwh)</th><th className={`${thClass} w-20`}>초과전력량</th><th className={`${thClass} w-14`}>비 고</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {Object.keys(groupedItems).map(groupKey => {
                  const items = groupedItems[groupKey];
                  return items.map((item, idx) => {
                    const { diff, usage, bill, excess } = getCalculations(item);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        {idx === 0 && (
                          <><td rowSpan={items.length} className={`${tdClass} px-2 text-left border-r border-gray-300`}><div className="flex items-center justify-between"><input type="text" readOnly className="w-full text-left outline-none bg-transparent font-normal text-blue-800 text-[12px] truncate" value={item.tenant} /><FileText size={14} className="text-blue-500 shrink-0 ml-1 cursor-pointer hover:text-blue-700 transition-colors" onClick={() => handlePrintTenantBill(item.tenant, item.floor)} /></div></td><td rowSpan={items.length} className={`${tdClass} border-r border-gray-300 font-normal`}><input type="text" readOnly className="w-full text-center outline-none bg-transparent font-normal text-[12px]" value={item.floor} /></td><td rowSpan={items.length} className={`${tdClass} border-r border-gray-300 font-normal`}><input type="text" readOnly className="w-full text-center outline-none bg-transparent font-normal text-[12px]" value={formatNumber(item.area)} /></td><td rowSpan={items.length} className={`${tdClass} border-r border-gray-300`}><input type="text" readOnly className="w-full text-center outline-none bg-transparent font-normal text-emerald-600 text-[12px]" value={formatNumber(item.refPower)} /></td></>
                        )}
                        <td className={`${tdClass} text-right pr-2 border-r border-gray-200`}><span className={`font-normal ${bill < 0 ? 'text-red-600' : 'text-blue-600'}`}>{bill.toLocaleString()}</span></td>
                        <td className={`${tdClass} border-r border-gray-200`}>
                          <input 
                            type="text" 
                            readOnly={!isEditMode} 
                            className={`${inputClass} text-orange-500 text-[12px] ${isEditMode ? 'bg-orange-50 focus:ring-1 focus:ring-orange-300' : ''}`} 
                            value={formatNumber(item.currentReading)} 
                            onChange={e => updateItemField(item.id, 'currentReading', e.target.value)}
                          />
                        </td>
                        <td className={`${tdClass} border-r border-gray-200`}><input type="text" readOnly className={`${inputClass} text-[12px]`} value={formatNumber(item.prevReading)} /></td><td className={`${tdClass} border-r border-gray-200 text-gray-500`}>{diff.toLocaleString()}</td><td className={`${tdClass} border-r border-gray-200 font-normal`}>{usage.toLocaleString()}</td><td className={`${tdClass} border-r border-gray-200 font-normal ${excess !== null && (excess as number) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{excess !== null ? (excess as number).toLocaleString() : ''}</td><td className={`${tdClass} border-r border-gray-200`}><select disabled className="w-full h-full text-center outline-none bg-transparent appearance-none font-normal text-gray-600 text-[12px]" value={item.note}><option value="일반">일반</option><option value="특수">특수</option></select></td>
                      </tr>
                    );
                  });
                })}
                <tr className="bg-blue-50/50 font-normal border-t-2 border-gray-400"><td colSpan={2} className={`${tdClass} border-r border-gray-300 bg-gray-100`}>합 계</td><td className={`${tdClass} border-r border-gray-300`}>{totalArea.toLocaleString()}</td><td className={`${tdClass} border-r border-gray-300`}></td><td className={`${tdClass} text-right pr-2 border-r border-gray-200 text-blue-700`}>{totalCalculatedBill.toLocaleString()}</td><td colSpan={3} className={`${tdClass} border-r border-gray-200`}></td><td className={`${tdClass} border-r border-gray-200 text-orange-600`}>{totalCalculatedUsage.toLocaleString()}</td><td colSpan={2} className={`${tdClass}`}></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"><div className="p-6 text-center"><div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-blue-100"><Cloud className="text-blue-600" size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">계량기 검침 데이터 저장</h3><p className="text-gray-500 mb-8 leading-relaxed">작성하신 <span className="text-blue-600 font-bold">월별 검침 지침과 요약 정보</span>를<br/>서버에 안전하게 기록하시겠습니까?</p><div className="flex gap-3"><button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors flex items-center justify-center active:scale-95"><X size={18} className="mr-2" />취소</button><button onClick={handleSave} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center active:scale-95"><CheckCircle2 size={18} className="mr-2" />확인</button></div></div></div>
        </div>
      )}
      <style>{`@keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }.animate-scale-up { animation: scale-up 0.2s ease-out forwards; }`}</style>
    </div>
  );
};

export default MeterReadingLog;
