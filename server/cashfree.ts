import crypto from 'crypto';

export interface CashfreeCustomerDetails {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

export interface CashfreeOrderSplit {
  vendor_id: string;
  amount?: number;
  percentage?: number;
  tags?: Record<string, string>;
}

export interface CreateOrderParams {
  orderId: string;
  orderAmount: number;
  orderCurrency?: string;
  customerDetails: CashfreeCustomerDetails;
  orderNote?: string;
  orderSplits?: CashfreeOrderSplit[];
}

export interface RegisterVendorParams {
  vendor_id: string;
  name: string;
  email: string;
  phone: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  upi_vpa?: string;
  pan?: string;
  verify_account?: boolean;
}

export class CashfreeServerService {
  private appId: string;
  private secretKey: string;
  private environment: 'sandbox' | 'production';
  private apiVersion: string;
  private baseUrl: string;

  constructor() {
    this.appId = process.env.CASHFREE_APP_ID || '';
    this.secretKey = process.env.CASHFREE_SECRET_KEY || '';
    this.environment = (process.env.CASHFREE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';
    this.baseUrl = this.environment === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  }

  public isConfigured(): boolean {
    if (!this.appId || !this.secretKey) return false;
    const isPlaceholder =
      this.appId === '123' ||
      this.appId.startsWith('123') ||
      this.appId.includes('your_cashfree') ||
      this.appId === 'dummy' ||
      this.appId.length < 8 ||
      this.secretKey === '123' ||
      this.secretKey.startsWith('123') ||
      this.secretKey.includes('your_cashfree') ||
      this.secretKey.length < 8;
    return !isPlaceholder;
  }

  public getEnvironment(): string {
    return this.environment;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-client-id': this.appId,
      'x-client-secret': this.secretKey,
      'x-api-version': this.apiVersion
    };
  }

  /**
   * Create Cashfree Order with Easy Split Support
   */
  public async createOrder(params: CreateOrderParams) {
    const safeOrderId = String(params.orderId || '').trim();
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(safeOrderId)) {
      throw new Error('Invalid orderId format.');
    }
    if (!Number.isFinite(params.orderAmount) || params.orderAmount <= 0) {
      throw new Error('Order amount must be a positive number.');
    }

    const isProd = process.env.NODE_ENV === 'production';

    if (!this.isConfigured()) {
      if (isProd) {
        throw new Error('Payment gateway credentials are not configured for production.');
      }
      // Sandbox preview fallback in non-production environments only
      return {
        isSimulated: true,
        order_id: safeOrderId,
        order_amount: params.orderAmount,
        order_currency: params.orderCurrency || 'INR',
        payment_session_id: `session_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        order_status: 'ACTIVE',
        order_splits: params.orderSplits || []
      };
    }

    const payload: any = {
      order_id: safeOrderId,
      order_amount: params.orderAmount,
      order_currency: params.orderCurrency || 'INR',
      customer_details: params.customerDetails,
      order_meta: {
        return_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment-return?order_id=${encodeURIComponent(safeOrderId)}`
      },
      order_note: params.orderNote || 'Zuggi Freight Escrow Payment'
    };

    if (params.orderSplits && params.orderSplits.length > 0) {
      payload.order_splits = params.orderSplits;
    }

    try {
      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || data?.code === 'request_failed' || data?.type === 'authentication_error') {
        if (isProd) {
          throw new Error('Payment gateway rejected order initialization.');
        }
        return {
          isSimulated: true,
          order_id: safeOrderId,
          order_amount: params.orderAmount,
          order_currency: params.orderCurrency || 'INR',
          payment_session_id: `session_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          order_status: 'ACTIVE',
          order_splits: params.orderSplits || []
        };
      }
      return data;
    } catch (err: any) {
      if (isProd) {
        throw err instanceof Error ? err : new Error('Payment gateway unreachable.');
      }
      return {
        isSimulated: true,
        order_id: safeOrderId,
        order_amount: params.orderAmount,
        order_currency: params.orderCurrency || 'INR',
        payment_session_id: `session_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        order_status: 'ACTIVE',
        order_splits: params.orderSplits || []
      };
    }
  }

  /**
   * Verify Cashfree Order Status Directly from Gateway.
   * Never fabricates a PAID status on error or in production.
   */
  public async getOrder(orderId: string) {
    const safeOrderId = String(orderId || '').trim();
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(safeOrderId)) {
      return {
        order_id: safeOrderId,
        order_status: 'FAILED',
        verified: false,
        message: 'Invalid order identifier.'
      };
    }

    const isProd = process.env.NODE_ENV === 'production';

    if (!this.isConfigured()) {
      if (isProd) {
        return {
          order_id: safeOrderId,
          order_status: 'FAILED',
          verified: false,
          message: 'Payment gateway is not configured in production.'
        };
      }
      return {
        order_id: safeOrderId,
        order_status: 'ACTIVE',
        verified: false,
        isSimulated: true
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(safeOrderId)}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const data = await response.json();
      if (!response.ok || data?.code === 'request_failed' || data?.type === 'authentication_error') {
        return {
          order_id: safeOrderId,
          order_status: 'FAILED',
          verified: false,
          message: 'Unable to verify order with payment gateway.'
        };
      }
      return {
        ...data,
        verified: data?.order_status === 'PAID'
      };
    } catch {
      return {
        order_id: safeOrderId,
        order_status: 'FAILED',
        verified: false,
        message: 'Payment verification request failed.'
      };
    }
  }

  /**
   * Register or Update Vendor in Cashfree Easy Split
   */
  public async registerVendor(params: RegisterVendorParams) {
    const safeVendorId = String(params.vendor_id || '').trim();
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(safeVendorId)) {
      throw new Error('Invalid vendor_id format.');
    }

    const isProd = process.env.NODE_ENV === 'production';

    if (!this.isConfigured()) {
      if (isProd) {
        throw new Error('Payment gateway credentials are not configured for vendor onboarding.');
      }
      return {
        vendor_id: safeVendorId,
        status: 'ACTIVE',
        name: params.name,
        email: params.email,
        phone: params.phone,
        penny_drop_status: 'SUCCESS',
        isSimulated: true
      };
    }

    const payload: any = {
      vendor_id: safeVendorId,
      name: params.name,
      email: params.email,
      phone: params.phone,
      verify_account: params.verify_account !== false
    };

    if (params.bank_account_number && params.bank_ifsc) {
      payload.bank_details = {
        account_number: params.bank_account_number,
        ifsc: params.bank_ifsc
      };
    } else if (params.upi_vpa) {
      payload.upi_details = {
        vpa: params.upi_vpa
      };
    }

    if (params.pan) {
      payload.kyc_details = {
        pan: params.pan
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/easy-split/vendors`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || data?.code === 'request_failed' || data?.type === 'authentication_error') {
        if (isProd) {
          throw new Error('Vendor payout registration failed at payment gateway.');
        }
        return {
          vendor_id: safeVendorId,
          status: 'ACTIVE',
          name: params.name,
          email: params.email,
          phone: params.phone,
          penny_drop_status: 'SUCCESS',
          isSimulated: true
        };
      }
      return data;
    } catch (err: any) {
      if (isProd) {
        throw err instanceof Error ? err : new Error('Vendor registration request failed.');
      }
      return {
        vendor_id: safeVendorId,
        status: 'ACTIVE',
        name: params.name,
        isSimulated: true
      };
    }
  }

  /**
   * Verify Cashfree Webhook Signature (HMAC-SHA256) with timestamp freshness replay protection (±5 min).
   */
  public verifyWebhook(signature: string, timestamp: string, rawBody: string): boolean {
    const cleanSig = String(signature || '').trim();
    const cleanTs = String(timestamp || '').trim();

    if (!cleanSig || !cleanTs || !rawBody) {
      return false;
    }

    // Timestamp freshness check (±5 minutes) to prevent webhook replay attacks
    const parsedNum = Number(cleanTs);
    if (!Number.isFinite(parsedNum) || parsedNum <= 0) {
      return false;
    }
    const tsMs = parsedNum < 1e12 ? parsedNum * 1000 : parsedNum;
    const MAX_SKEW_MS = 5 * 60 * 1000;
    if (Math.abs(Date.now() - tsMs) > MAX_SKEW_MS) {
      return false;
    }

    if (!this.isConfigured()) {
      return false;
    }

    try {
      const signedPayload = cleanTs + rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(signedPayload)
        .digest('base64');

      const sigBuffer = Buffer.from(cleanSig);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      console.error('Webhook signature verification exception');
      return false;
    }
  }
}

export const cashfreeServer = new CashfreeServerService();
