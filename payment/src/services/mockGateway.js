import logger from '../utils/logger.js';

export const mockGateway = {
  /**
   * Simulates processing a payment with a mock bank / card gateway
   * @param {object} params
   * @param {number} params.amount
   * @param {string} params.currency
   * @param {string} params.payment_method
   * @param {string} [params.card_number]
   * @param {string} [params.mock_action]
   * @returns {Promise<object>}
   */
  async charge({
    amount,
    currency = 'USD',
    payment_method = 'MOCK_CARD',
    card_number = '4242 4242 4242 4242',
    mock_action = 'SUCCESS',
  }) {
    // 1. Simulate standard network latency (150ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    const cleanCard = card_number.replace(/\s+/g, '');
    const last4 = cleanCard.slice(-4) || '4242';

    // 2. Magic card number resolution or explicit mock_action trigger
    let outcome = mock_action;

    if (cleanCard.endsWith('0002')) {
      outcome = 'DECLINE';
    } else if (cleanCard.endsWith('0004')) {
      outcome = 'EXPIRED_CARD';
    } else if (cleanCard.endsWith('0999')) {
      outcome = 'INSUFFICIENT_FUNDS';
    }

    const txId = `tx_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 3. Handle Failure Scenarios
    if (outcome === 'DECLINE') {
      logger.warn({ amount, last4 }, 'Mock payment: Card declined');
      return {
        success: false,
        status: 'FAILED',
        error_code: 'CARD_DECLINED',
        error_message: 'Your mock card was declined by the issuing bank.',
        transaction_id: txId,
        gateway_response: {
          decline_code: 'do_not_honor',
          network_status: 'declined_by_issuer',
          risk_level: 'normal',
          last4,
        },
      };
    }

    if (outcome === 'INSUFFICIENT_FUNDS') {
      logger.warn({ amount, last4 }, 'Mock payment: Insufficient funds');
      return {
        success: false,
        status: 'FAILED',
        error_code: 'INSUFFICIENT_FUNDS',
        error_message: 'The card account does not have sufficient funds for this transaction.',
        transaction_id: txId,
        gateway_response: {
          decline_code: 'insufficient_funds',
          last4,
        },
      };
    }

    if (outcome === 'EXPIRED_CARD') {
      logger.warn({ amount, last4 }, 'Mock payment: Expired card');
      return {
        success: false,
        status: 'FAILED',
        error_code: 'EXPIRED_CARD',
        error_message: 'The simulated credit card has expired.',
        transaction_id: txId,
        gateway_response: {
          decline_code: 'expired_card',
          last4,
        },
      };
    }

    if (outcome === 'NETWORK_TIMEOUT') {
      logger.error('Mock payment: Simulated gateway network timeout');
      return {
        success: false,
        status: 'FAILED',
        error_code: 'GATEWAY_TIMEOUT',
        error_message: 'Simulated payment gateway timeout. Please retry.',
        transaction_id: txId,
        gateway_response: {
          network_status: 'timeout',
        },
      };
    }

    // 4. Default Success Outcome
    const authCode = Math.floor(100000 + Math.random() * 900000).toString();
    logger.info({ amount, currency, txId, authCode }, 'Mock payment authorized and captured successfully');

    return {
      success: true,
      status: 'CAPTURED',
      transaction_id: txId,
      authorization_code: authCode,
      gateway_response: {
        captured: true,
        currency,
        amount,
        payment_method,
        card_brand: cleanCard.startsWith('4') ? 'Visa' : 'Mastercard',
        last4,
        auth_code: authCode,
        simulated_at: new Date().toISOString(),
      },
    };
  },

  /**
   * Simulates a mock refund
   */
  async refund({ payment_id, transaction_id, amount }) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const refundTxId = `ref_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    logger.info({ payment_id, amount, refundTxId }, 'Mock refund processed');

    return {
      success: true,
      refund_transaction_id: refundTxId,
      original_transaction_id: transaction_id,
      amount,
      status: 'REFUNDED',
      simulated_at: new Date().toISOString(),
    };
  },
};

export default mockGateway;
