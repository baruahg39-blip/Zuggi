import { User } from '../types';
import { logisticsStore } from './store';

export interface CashfreeGatewayConfig {
  success: boolean;
  isConfigured: boolean;
  environment: string;
  merchantType: string;
  commissionRatePct: number;
}

export interface CashfreeOrderResult {
  isSimulated?: boolean;
  order_id: string;
  order_amount: number;
  order_currency: string;
  payment_session_id?: string;
  order_status: string;
  order_splits?: any[];
  apiNotice?: string;
  verified?: boolean;
}

export class CashfreeClientService {
  private configCache: CashfreeGatewayConfig | null = null;

  public async getConfig(): Promise<CashfreeGatewayConfig> {
    if (this.configCache) return this.configCache;
    try {
      const res = await fetch('/api/payments/cashfree/config');
      const data = await res.json();
      this.configCache = data;
      return data;
    } catch {
      return {
        success: true,
        isConfigured: false,
        environment: 'sandbox',
        merchantType: 'Marketplace Easy Split',
        commissionRatePct: 5
      };
    }
  }

  /**
   * Create 2-stage Cashfree Escrow Order (90% advance or 10% balance).
   * Server independently computes totals, commission, GST, and driver split from bookingId.
   */
  public async createOrder(params: {
    bookingId: string;
    stage: 'advance_90' | 'balance_10';
    amount: number;
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string;
    };
    driverVendorId?: string;
    driverPayoutAmount?: number;
  }): Promise<{ success: boolean; data?: CashfreeOrderResult; message?: string }> {
    try {
      const orderId = `CF_${params.bookingId}_${params.stage}_${Date.now()}`;

      const payload: any = {
        orderId,
        bookingId: params.bookingId,
        stage: params.stage,
        orderAmount: params.amount,
        customerDetails: {
          customer_id: params.customer.id.replace(/[^a-zA-Z0-9_-]/g, '_'),
          customer_name: params.customer.name,
          customer_email: params.customer.email || 'customer@zuggi.in',
          customer_phone: params.customer.phone.replace(/[^0-9]/g, '').slice(-10) || '9876543210'
        },
        orderNote: `Zuggi Escrow: ${params.stage === 'advance_90' ? '90% Advance Before Pickup' : '10% Final Balance Post-Delivery'}`
      };

      const res = await fetch('/api/payments/cashfree/create-order', {
        method: 'POST',
        headers: logisticsStore.buildAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Payment order initialization failed');
      }

      return { success: true, data: json.data };
    } catch (err: any) {
      console.error('Failed to create Cashfree order:', err?.message || 'unknown_error');
      return { success: false, message: err.message };
    }
  }

  /**
   * Verify order payment status directly from server/gateway (never fakes PAID on network failure).
   */
  public async verifyOrder(orderId: string): Promise<any> {
    try {
      const res = await fetch('/api/payments/cashfree/verify-order', {
        method: 'POST',
        headers: logisticsStore.buildAuthHeaders(true),
        body: JSON.stringify({ orderId })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        return { order_id: orderId, order_status: 'FAILED', verified: false, message: json?.message };
      }
      return json.data;
    } catch {
      console.warn('Verify order error: unable to reach payment server');
      return { order_id: orderId, order_status: 'FAILED', verified: false };
    }
  }

  /**
   * Register or update authenticated driver/transporter in Cashfree Easy Split
   */
  public async registerVendor(driver: User, bank: {
    accountNumber: string;
    ifsc: string;
    upi: string;
    pan: string;
  }) {
    try {
      const vendorId = `vnd_${driver.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const hasBank = Boolean(bank.accountNumber?.trim() && bank.ifsc?.trim());
      const vendorPayload: Record<string, any> = {
        vendor_id: vendorId,
        name: driver.businessName || driver.name,
        email: driver.email && !driver.email.includes(driver.phone.replace(/\D/g, '').slice(-10))
          ? driver.email
          : 'partner@zuggi.in',
        phone: driver.phone.replace(/[^0-9]/g, '').slice(-10) || '9876543210',
        pan: bank.pan,
        verify_account: true
      };
      // Data minimization: send either bank account or UPI VPA (never redundant payout identifiers)
      if (hasBank) {
        vendorPayload.bank_account_number = bank.accountNumber.trim();
        vendorPayload.bank_ifsc = bank.ifsc.trim().toUpperCase();
      } else if (bank.upi?.trim()) {
        vendorPayload.upi_vpa = bank.upi.trim();
      }
      const res = await fetch('/api/payments/cashfree/register-vendor', {
        method: 'POST',
        headers: logisticsStore.buildAuthHeaders(true),
        body: JSON.stringify(vendorPayload)
      });
      return await res.json();
    } catch {
      return {
        success: false,
        message: 'Unable to reach payout registration service.'
      };
    }
  }
}

export const cashfreeClient = new CashfreeClientService();
