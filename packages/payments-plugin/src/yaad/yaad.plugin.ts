import { PluginCommonModule, RuntimeVendureConfig, VendurePlugin } from '@vendure/core';

import { shopApiExtensions } from './api-extensions';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { YaadController } from './yaad.controller';
import { yaadPaymentHandler } from './yaad.handler';
import { YaadService } from './yaad.service';
import { YaadShopResolver } from './yaad.shop-resolver';

/**
 * @description
 * Configuration options for the Yaad payments plugin.
 */
export interface YaadPluginOptions {
    /**
     * @description
     * Public URL of the storefront, used to build the redirect back to the customer after the
     * Yaad callback. e.g. `'https://myshop.com'`.
     */
    storefrontHost: string;
}

/**
 * @description
 * Plugin to enable payments through Yaad Sarig's hosted payment page (icom.yaad.net).
 *
 * ## Flow
 *
 * 1. Storefront calls the `createYaadPaymentIntent` mutation. The plugin builds a Yaad APISign
 *    URL and returns the signed redirect URL.
 * 2. Storefront redirects the customer to that URL. The customer pays on icom.yaad.net.
 * 3. Yaad redirects the customer (GET) to the URL configured in the Yaad Masof dashboard, which
 *    must be `{vendureHost}/payments/yaad/callback`.
 * 4. The plugin's controller verifies the transaction with Yaad's VERIFY API, transitions the
 *    order to ArrangingPayment, adds a Settled payment, and redirects the customer to
 *    `{storefrontHost}/{locale}/order-confirmation/{orderCode}`.
 *
 * ## Setup
 *
 * 1. Add the plugin to your VendureConfig:
 * ```ts
 * import { YaadPlugin } from '\@vendure/payments-plugin/package/yaad';
 *
 * plugins: [
 *   YaadPlugin.init({ storefrontHost: 'http://localhost:3001' }),
 * ]
 * ```
 * 2. In the Vendure admin UI, create a new PaymentMethod with `Yaad Sarig payment` as the
 *    handler and fill in KEY / PassP / Masof from your Yaad terminal.
 * 3. In your Yaad Masof dashboard, set the success URL to
 *    `{vendureHost}/payments/yaad/callback`.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [YaadController],
    providers: [YaadService, { provide: PLUGIN_INIT_OPTIONS, useFactory: () => YaadPlugin.options }],
    configuration: (config: RuntimeVendureConfig) => {
        config.paymentOptions.paymentMethodHandlers.push(yaadPaymentHandler);
        return config;
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [YaadShopResolver],
    },
    compatibility: '^3.0.0',
})
export class YaadPlugin {
    static options: YaadPluginOptions;

    static init(options: YaadPluginOptions): typeof YaadPlugin {
        this.options = options;
        return YaadPlugin;
    }
}
