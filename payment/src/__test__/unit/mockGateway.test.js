import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/logger", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { default: mockGateway } = await import("../../services/mockGateway.js");

const { default: logger } = await import("../../utils/logger.js");

const mockCharge = (overrides = {}) => ({
  amount: 1000,
  currency: "npr",
  payment_method: "MOCK_CARD",
  card_number: "4242 4242 4242 4242",
  mock_action: "SUCCESS",
  ...overrides,
});

describe("mockGateway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("charge", () => {
    it("should successfully process a payment with default parameters", async () => {
      const result = await mockGateway.charge({
        amount: 1000,
      });

      expect(result).toMatchObject({
        success: true,
        status: "CAPTURED",
        transaction_id: expect.stringMatching(/^tx_mock_/),
        authorization_code: expect.stringMatching(/^\d{6}$/),
        gateway_response: {
          captured: true,
          currency: "npr",
          amount: 1000,
          payment_method: "MOCK_CARD",
          card_brand: "Visa",
          last4: "4242",
        },
      });

      expect(result.gateway_response.simulated_at).toEqual(expect.any(String));

      expect(new Date(result.gateway_response.simulated_at).toISOString()).toBe(
        result.gateway_response.simulated_at,
      );

      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should successfully process a payment with custom parameters", async () => {
        const result= await mockGateway.charge({
            amount: 2500,
            currency: "usd",
            payment_method: "MOCK_CARD",
            card_number: "5555 5555 5555 4444",
            mock_action: "SUCCESS",
        })

        expect(result.success).toBe(true);
        expect(result.status).toBe('CAPTURED');

        expect(result.gateway_response).toMatchObject({
            amount: 2500,
            currency: "usd",
            payment_method: "MOCK_CARD",
            card_brand: "Mastercard",
            last4: "4444",
            captured: true,
        })
    })

    it('should identify visa card correctly', async () => {
        const result= await mockGateway.charge({
            amount: 1500,
            card_number: "4111 1111 1111 1111",
        });

        expect(result.gateway_response.card_brand).toBe('Visa');
    });

    it('should identify mastercard correctly', async () => {
        const result= await mockGateway.charge({
            amount: 1500,
            card_number: "5555 5555 5555 4444",
        });

        expect(result.gateway_response.card_brand).toBe('Mastercard');
    });

    it('should remove whitespaces from card number before processing', async () => {
        const result= await mockGateway.charge({
            amount: 1500,
            card_number: "  5555 5555 5555 4444  ",
        });

        expect(result.gateway_response.last4).toBe('4444');

    });

    it('should generate unique transaction id', async () => {
        const [first, second]= await Promise.all([
            mockGateway.charge({ amount: 1000 }),
            mockGateway.charge({ amount: 2000 }),
        ])
        expect(first.transaction_id).not.toBe(second.transaction_id);
    });

    
  });
});
