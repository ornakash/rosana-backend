import { Inject, Injectable } from '@nestjs/common';
import {
    ActiveOrderService,
    assertFound,
    ID,
    idsAreEqual,
    LanguageCode,
    Logger,
    Order,
    OrderService,
    OrderStateTransitionError,
    PaymentMethod,
    PaymentMethodService,
    RequestContext,
} from '@vendure/core';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import {
    ErrorCode,
    YaadPaymentIntentError,
    YaadPaymentIntentInput,
    YaadPaymentIntentResult,
} from './graphql/generated-shop-types';
import { YaadPaymentMetadata } from './types';
import { yaadPaymentHandler } from './yaad.handler';
import { buildSignUrl, verifyCallback, YaadCredentials } from './yaad.helpers';
import { YaadPluginOptions } from './yaad.plugin';

class PaymentIntentError implements YaadPaymentIntentError {
    errorCode = ErrorCode.ORDER_PAYMENT_STATE_ERROR;

    constructor(public message: string) {}
}

class InvalidInputError implements YaadPaymentIntentError {
    errorCode = ErrorCode.INELIGIBLE_PAYMENT_METHOD_ERROR;

    constructor(public message: string) {}
}

@Injectable()
export class YaadService {
    constructor(
        private paymentMethodService: PaymentMethodService,
        @Inject(PLUGIN_INIT_OPTIONS) private options: YaadPluginOptions,
        private activeOrderService: ActiveOrderService,
        private orderService: OrderService,
    ) {}

    /**
     * Build the signed Yaad redirect URL for the active order.
     */
    async createPaymentIntent(
        ctx: RequestContext,
        input: YaadPaymentIntentInput,
    ): Promise<YaadPaymentIntentResult> {
        const [order, paymentMethod] = await Promise.all([
            this.getOrder(ctx, input.orderId),
            this.getPaymentMethod(ctx, input.paymentMethodCode),
        ]);
        if (order instanceof PaymentIntentError) {
            return order;
        }
        if (!paymentMethod) {
            return new PaymentIntentError(
                `No paymentMethod found with code ${String(input.paymentMethodCode)}`,
            );
        }

        const eligible = await this.orderService.getEligiblePaymentMethods(ctx, order.id);
        if (!eligible.find(m => idsAreEqual(m.id, paymentMethod.id) && m.isEligible)) {
            return new InvalidInputError(
                `Payment method ${paymentMethod.code} is not eligible for order ${order.code}`,
            );
        }

        const creds = this.getCredentials(paymentMethod);
        if (!creds) {
            return new PaymentIntentError(`Payment method ${paymentMethod.code} is not fully configured`);
        }

        if (!order.customer?.firstName || !order.customer?.lastName) {
            return new PaymentIntentError(
                'Cannot create Yaad payment intent for order with customer missing firstName/lastName',
            );
        }

        // Yaad's Amount is in major currency units; Vendure stores money in minor units (e.g. agorot)
        const amountMajor = (order.totalWithTax / 100).toFixed(2);
        const pageLang = ctx.languageCode === LanguageCode.he ? 'HEB' : 'ENG';

        // Yaad's success URL is configured in the Yaad Masof dashboard. To know how to redirect the
        // user back to the right storefront URL after the callback, we echo the locale via Fild1.
        const fild1 = input.locale || ctx.languageCode;

        const signRequestUrl = buildSignUrl(creds, {
            amount: amountMajor,
            orderCode: order.code,
            info: `Order ${order.code}`,
            clientName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
            email: order.customer.emailAddress,
            phone: order.customer.phoneNumber || '1',
            cell: order.customer.phoneNumber || '1',
            pageLang,
            fild1,
        });

        const response = await fetch(signRequestUrl);
        const signedQuery = (await response.text()).trim();
        if (!signedQuery || signedQuery.startsWith('CCode=')) {
            // Yaad returns an error querystring instead of a signed body when something is wrong
            Logger.error(`Yaad APISign failed for order ${order.code}: ${signedQuery}`, loggerCtx);
            return new PaymentIntentError(`Yaad APISign failed: ${signedQuery || 'empty response'}`);
        }

        const url = `https://icom.yaad.net/p/?${signedQuery}`;
        Logger.info(`Created Yaad redirect URL for order ${order.code}`, loggerCtx);
        return { url };
    }

    /**
     * Process the Yaad callback (GET) by verifying with Yaad, then transitioning the order
     * to ArrangingPayment and adding a Settled/Declined payment.
     *
     * Returns the order code and outcome so the controller can redirect the user appropriately.
     */
    async handleCallback(
        ctx: RequestContext,
        callbackParams: Record<string, string>,
    ): Promise<{ outcome: 'success' | 'failure'; redirectUrl: string }> {
        const orderCode = callbackParams.Order || null;
        const locale = callbackParams.Fild1 || null;

        // Resolve the Yaad PaymentMethod up front — it's the source of truth for both credentials
        // and the configurable redirect URLs.
        const paymentMethod = await this.findYaadPaymentMethod(ctx);

        const fail = (reason: string) => {
            Logger.error(`Yaad callback failed: ${reason}`, loggerCtx);
            return {
                outcome: 'failure' as const,
                redirectUrl: this.buildRedirectUrl('failure', orderCode, locale, paymentMethod),
            };
        };

        if (!orderCode) return fail('missing Order param');
        if (!paymentMethod) return fail('no Yaad payment method configured for current channel');

        const creds = this.getCredentials(paymentMethod);
        if (!creds) return fail(`Yaad payment method ${paymentMethod.code} is not fully configured`);

        const verification = await verifyCallback(creds, callbackParams);

        const order = await this.orderService.findOneByCode(ctx, orderCode, ['payments']);
        if (!order) return fail(`unknown order code ${orderCode}`);

        if (order.orderPlacedAt) {
            const existing = order.payments.find(
                p => p.transactionId && p.transactionId === callbackParams.Id,
            );
            if (existing) {
                Logger.info(
                    `Yaad callback for order ${orderCode} already processed (transaction ${callbackParams.Id})`,
                    loggerCtx,
                );
                return {
                    outcome: 'success',
                    redirectUrl: this.buildRedirectUrl('success', orderCode, locale, paymentMethod),
                };
            }
            return fail(
                `already-placed order ${orderCode} with new transaction ${callbackParams.Id} — possible duplicate charge`,
            );
        }

        const status: 'Settled' | 'Declined' = verification.ok ? 'Settled' : 'Declined';
        const metadata: YaadPaymentMetadata = {
            amount: order.totalWithTax,
            status,
            transactionId: callbackParams.Id || `yaad-${orderCode}-${Date.now()}`,
            last4digits: callbackParams.L4digit,
            cardBrand: callbackParams.Brand,
            cardIssuer: callbackParams.Issuer,
            expMonth: callbackParams.Tmonth,
            expYear: callbackParams.Tyear,
            israelId: callbackParams.UserId,
            rawCallbackQuery: new URLSearchParams(callbackParams).toString(),
        };

        if (order.state !== 'ArrangingPayment' && order.state !== 'ArrangingAdditionalPayment') {
            const transition = await this.orderService.transitionToState(ctx, order.id, 'ArrangingPayment');
            if (transition instanceof OrderStateTransitionError) {
                return fail(
                    `cannot transition order ${order.code} to ArrangingPayment: ${transition.message}`,
                );
            }
        }

        const addPaymentResult = await this.orderService.addPaymentToOrder(ctx, order.id, {
            method: paymentMethod.code,
            metadata,
        });
        if (!(addPaymentResult instanceof Order)) {
            return fail(`addPaymentToOrder failed for ${order.code}: ${addPaymentResult.message}`);
        }

        Logger.info(`Yaad callback for order ${orderCode} processed with outcome '${status}'`, loggerCtx);
        const outcome: 'success' | 'failure' = status === 'Settled' ? 'success' : 'failure';
        return {
            outcome,
            redirectUrl: this.buildRedirectUrl(outcome, orderCode, locale, paymentMethod),
        };
    }

    /**
     * Build the storefront redirect URL for the given outcome. Prefers the URL configured on the
     * PaymentMethod (successUrl / failureUrl args, with {orderCode} and {locale} substitution).
     * Falls back to a sensible default under `storefrontHost`.
     */
    private buildRedirectUrl(
        outcome: 'success' | 'failure',
        orderCode: string | null,
        locale: string | null,
        paymentMethod: PaymentMethod | undefined,
    ): string {
        const argName = outcome === 'success' ? 'successUrl' : 'failureUrl';
        const template = paymentMethod?.handler.args.find(a => a.name === argName)?.value?.trim();

        if (template) {
            return template
                .replaceAll('{orderCode}', encodeURIComponent(orderCode || ''))
                .replaceAll('{locale}', encodeURIComponent(locale || ''));
        }

        const storefrontHost = this.options.storefrontHost.replace(/\/$/, '');
        const localeSegment = locale ? `/${encodeURIComponent(locale)}` : '';
        if (outcome === 'success' && orderCode) {
            return `${storefrontHost}${localeSegment}/order-confirmation/${encodeURIComponent(orderCode)}`;
        }
        const params = new URLSearchParams({
            error: 'yaad',
            ...(orderCode ? { orderCode } : {}),
        });
        return `${storefrontHost}${localeSegment}/checkout?${params.toString()}`;
    }

    private getCredentials(paymentMethod: PaymentMethod): YaadCredentials | null {
        const args = paymentMethod.handler.args;
        const key = args.find(a => a.name === 'key')?.value;
        const passP = args.find(a => a.name === 'passP')?.value;
        const masof = args.find(a => a.name === 'masof')?.value;
        if (!key || !passP || !masof) return null;
        return { key, passP, masof };
    }

    private async findYaadPaymentMethod(ctx: RequestContext): Promise<PaymentMethod | undefined> {
        const { items } = await this.paymentMethodService.findAll(ctx);
        return items.find(pm => pm.handler.code === yaadPaymentHandler.code);
    }

    private async getPaymentMethod(
        ctx: RequestContext,
        paymentMethodCode?: string | null,
    ): Promise<PaymentMethod | undefined> {
        if (paymentMethodCode) {
            const { items } = await this.paymentMethodService.findAll(ctx, {
                filter: { code: { eq: paymentMethodCode } },
            });
            return items.find(pm => pm.code === paymentMethodCode);
        }
        return this.findYaadPaymentMethod(ctx);
    }

    private async getOrder(ctx: RequestContext, orderId?: ID | null): Promise<Order | PaymentIntentError> {
        if (!orderId) {
            const active = await this.activeOrderService.getActiveOrder(ctx, undefined);
            if (!active) return new PaymentIntentError('No active order found for session');
            orderId = active.id;
        }
        return await assertFound(this.orderService.findOne(ctx, orderId, ['customer', 'lines', 'payments']));
    }
}
