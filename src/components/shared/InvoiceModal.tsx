import React from 'react';
import { X, Printer, Download, ShieldCheck, Truck, FileText } from 'lucide-react';
import { Invoice } from '../../types';
import { logisticsStore } from '../../services/store';

interface InvoiceModalProps {
  bookingId: string;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  bookingId,
  onClose
}) => {
  const invoice = logisticsStore.getInvoiceByBookingId(bookingId) || logisticsStore.getInvoices()[0];
  const booking = logisticsStore.getBookingById(bookingId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white text-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Controls Bar (Hidden during print) */}
        <div className="no-print p-4 bg-slate-900 border-b border-slate-800 text-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">Goods Transport Agency (GTA) Tax Invoice</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Indian GST Invoice Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-xs text-slate-800 bg-white">
          {/* Header & Logo */}
          <div className="flex items-start justify-between border-b pb-4 border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-sm">
                  ZUG
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight text-slate-900">Zuggi Freight</h1>
                  <p className="text-[10px] text-slate-500">Commercial Goods Transportation Platform (India)</p>
                </div>
              </div>
              <div className="text-[11px] text-slate-600 mt-2 space-y-0.5">
                <p>Regional HQ: Transport Nagar, NH-27, Beltola, Guwahati - 781028, Assam</p>
                <p>GSTIN: 18AAAFK4902L1ZQ • PAN: AAAFK4902L</p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border border-slate-300">
                TAX INVOICE / BILTY
              </span>
              <div className="text-base font-black font-mono text-slate-900 mt-1">
                {invoice.invoiceNumber}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Date: {invoice.invoiceDate}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Booking Ref: {invoice.bookingId}
              </div>
            </div>
          </div>

          {/* Consignor & Consignee Columns */}
          <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                CONSIGNOR (Shipper / Billed To)
              </span>
              <div className="font-bold text-slate-900 text-sm">{invoice.consignor.company}</div>
              <div className="text-slate-700 text-xs mt-0.5">{invoice.consignor.name}</div>
              <div className="text-slate-600 text-[11px] mt-1">{invoice.consignor.address}</div>
              <div className="text-slate-700 text-xs mt-1.5 font-semibold">
                GSTIN: <span className="font-mono text-slate-900">{invoice.consignor.gstin}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                CONSIGNEE (Delivery Destination)
              </span>
              <div className="font-bold text-slate-900 text-sm">{invoice.consignee.company || invoice.consignee.name}</div>
              <div className="text-slate-700 text-xs mt-0.5">{invoice.consignee.name}</div>
              <div className="text-slate-600 text-[11px] mt-1">{invoice.consignee.address}</div>
              <div className="text-slate-700 text-xs mt-1.5 font-semibold">
                State: <span className="font-semibold text-slate-900">{invoice.consignee.state}</span>
              </div>
            </div>
          </div>

          {/* Transporter & Vehicle Particulars */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] text-amber-800 uppercase font-bold block">Assigned Commercial Vehicle</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{invoice.transporter.regNumber}</span>
              <span className="text-slate-600 text-[11px] ml-2">({invoice.transporter.name})</span>
            </div>
            <div>
              <span className="text-[10px] text-amber-800 uppercase font-bold block">GST SAC Classification</span>
              <span className="font-mono font-bold text-slate-900">{invoice.sacCode}</span>
              <span className="text-slate-600 text-[11px] ml-1">(Road Freight Transport Services)</span>
            </div>
            <div>
              <span className="text-[10px] text-amber-800 uppercase font-bold block">Reverse Charge (RCM)</span>
              <span className="font-bold text-emerald-800">Applicable (5% RCM)</span>
            </div>
          </div>

          {/* Table of Charges */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Description of Freight Service</th>
                  <th className="p-3">SAC Code</th>
                  <th className="p-3 text-right">Taxable Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">Commercial Road Freight Charges</div>
                    <div className="text-[11px] text-slate-500">
                      Transport of packaged goods between {booking?.pickup.city || 'Dibrugarh'} and {booking?.delivery.city || 'Guwahati'}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-slate-600">{invoice.sacCode}</td>
                  <td className="p-3 font-mono text-right font-semibold">
                    ₹{invoice.freightAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {invoice.cgst > 0 && (
                  <tr>
                    <td className="p-3 text-slate-600 pl-6">CGST (2.5%)</td>
                    <td className="p-3 font-mono text-slate-500">996511</td>
                    <td className="p-3 font-mono text-right text-slate-600">
                      ₹{invoice.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}

                {invoice.sgst > 0 && (
                  <tr>
                    <td className="p-3 text-slate-600 pl-6">SGST (2.5%)</td>
                    <td className="p-3 font-mono text-slate-500">996511</td>
                    <td className="p-3 font-mono text-right text-slate-600">
                      ₹{invoice.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}

                {invoice.igst > 0 && (
                  <tr>
                    <td className="p-3 text-slate-600 pl-6">IGST (5.0% Interstate)</td>
                    <td className="p-3 font-mono text-slate-500">996511</td>
                    <td className="p-3 font-mono text-right text-slate-600">
                      ₹{invoice.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="p-3 text-slate-900 text-sm">Total Invoice Value (INR)</td>
                  <td className="p-3 text-right text-base text-slate-900 font-mono font-black">
                    ₹{invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Declaration & Signature */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-[11px] text-slate-600">
            <div>
              <p className="font-semibold text-slate-800">Declaration & Conditions:</p>
              <p className="mt-0.5 leading-relaxed">
                This is a computer-generated tax document issued under Section 31 of CGST Act, 2017. Goods were accepted for carriage subject to transporter&apos;s standard conditions. Reverse charge mechanism applies to registered recipients as notified.
              </p>
            </div>
            <div className="text-right flex flex-col justify-end">
              <div className="font-bold text-slate-900">For Zuggi Freight Network</div>
              <div className="text-[10px] text-slate-500 italic mt-6">Authorized Signatory / Digital Stamp</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
