export interface YaadPaymentMetadata {
    amount: number;
    status: 'Settled' | 'Declined';
    transactionId: string;
    last4digits?: string;
    cardBrand?: string;
    cardIssuer?: string;
    expMonth?: string;
    expYear?: string;
    israelId?: string;
    rawCallbackQuery?: string;
}
