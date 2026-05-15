import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ChannelService, LanguageCode, Logger, RequestContext, Transaction } from '@vendure/core';
import { Request, Response } from 'express';

import { loggerCtx } from './constants';
import { YaadService } from './yaad.service';

/**
 * Receives the Yaad callback after the customer completes (or cancels) payment on icom.yaad.net.
 *
 * Yaad redirects the customer with a GET request carrying all transaction params in the querystring.
 * The success URL must be configured in the Yaad Masof dashboard to point at this endpoint:
 *
 *     GET {vendureHost}/payments/yaad/callback
 *
 * After verifying with Yaad and adding the payment to the order, the controller 302s the user
 * back to the storefront's order-confirmation (success) or checkout (failure) page.
 */
@Controller('payments')
export class YaadController {
    constructor(
        private yaadService: YaadService,
        private channelService: ChannelService,
    ) {}

    @Get('yaad/callback')
    @Transaction()
    async callback(
        @Query() query: Record<string, string>,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        Logger.info(`Yaad callback received: ${JSON.stringify(query)}`, loggerCtx);
        const ctx = await this.createAdminContext(req);
        const { outcome, redirectUrl } = await this.yaadService.handleCallback(ctx, query);
        Logger.info(`Yaad callback outcome=${outcome}, redirecting to ${redirectUrl}`, loggerCtx);
        res.redirect(302, redirectUrl);
    }

    private async createAdminContext(req: Request): Promise<RequestContext> {
        const channel = await this.channelService.getDefaultChannel();
        return new RequestContext({
            apiType: 'admin',
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
            channel,
            // Workaround for the express v5 / v4 type mismatch in Vendure core, mirrors the
            // pattern used by MollieController.
            req: req as any,
            languageCode: LanguageCode.en,
        });
    }
}
