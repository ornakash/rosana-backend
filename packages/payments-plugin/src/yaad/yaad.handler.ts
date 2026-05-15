import { LanguageCode } from '@vendure/common/lib/generated-types';
import {
    CreatePaymentErrorResult,
    CreatePaymentResult,
    Logger,
    PaymentMethodHandler,
    SettlePaymentResult,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { YaadPaymentMetadata } from './types';

export const yaadPaymentHandler = new PaymentMethodHandler({
    code: 'yaad-payment-handler',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Yaad Sarig payment',
        },
    ],
    args: {
        key: {
            type: 'string',
            label: [{ languageCode: LanguageCode.en, value: 'KEY' }],
            description: [
                { languageCode: LanguageCode.en, value: 'Yaad API KEY (from the terminal config).' },
            ],
        },
        passP: {
            type: 'string',
            label: [{ languageCode: LanguageCode.en, value: 'PassP' }],
            description: [{ languageCode: LanguageCode.en, value: 'Yaad PassP secret.' }],
        },
        masof: {
            type: 'string',
            label: [{ languageCode: LanguageCode.en, value: 'Masof' }],
            description: [{ languageCode: LanguageCode.en, value: 'Yaad Masof (terminal) number.' }],
        },
        successUrl: {
            type: 'string',
            required: false,
            defaultValue: '',
            label: [{ languageCode: LanguageCode.en, value: 'Success redirect URL' }],
            description: [
                {
                    languageCode: LanguageCode.en,
                    value:
                        'URL the customer is sent to after a successful payment. Supports tokens ' +
                        '{orderCode} and {locale}. Leave blank to use the default: ' +
                        '{storefrontHost}/{locale}/order-confirmation/{orderCode}',
                },
            ],
        },
        failureUrl: {
            type: 'string',
            required: false,
            defaultValue: '',
            label: [{ languageCode: LanguageCode.en, value: 'Failure redirect URL' }],
            description: [
                {
                    languageCode: LanguageCode.en,
                    value:
                        'URL the customer is sent to after a failed/cancelled payment. Supports ' +
                        'tokens {orderCode} and {locale}. Leave blank to use the default: ' +
                        '{storefrontHost}/{locale}/checkout?error=yaad&orderCode={orderCode}',
                },
            ],
        },
    },
    createPayment: (ctx, order, amount, _args, metadata): CreatePaymentResult | CreatePaymentErrorResult => {
        // Only admin/internal callers (the Yaad callback controller) may create payments,
        // because we trust the VERIFY result they already performed.
        if (ctx.apiType !== 'admin' && ctx.apiType !== 'custom') {
            throw Error(`Yaad createPayment is not allowed for apiType '${ctx.apiType}'`);
        }
        const yaadMetadata = metadata as YaadPaymentMetadata;
        if (yaadMetadata.status !== 'Settled' && yaadMetadata.status !== 'Declined') {
            throw Error(
                `Yaad createPayment requires status 'Settled' or 'Declined', got '${String(
                    yaadMetadata.status,
                )}' for order ${order.code}`,
            );
        }
        Logger.info(
            `Yaad payment for order ${order.code} (amount=${yaadMetadata.amount}) recorded as '${yaadMetadata.status}'`,
            loggerCtx,
        );
        return {
            amount: yaadMetadata.amount,
            state: yaadMetadata.status,
            transactionId: yaadMetadata.transactionId,
            metadata: yaadMetadata,
        };
    },
    settlePayment: (): SettlePaymentResult => {
        // Yaad iframe charges immediately, so the payment is already in 'Settled' state when created.
        // This function is here only to satisfy the PaymentMethodHandler contract for the rare case
        // that a payment was created as 'Authorized' (not currently used by this handler).
        return { success: true };
    },
});
