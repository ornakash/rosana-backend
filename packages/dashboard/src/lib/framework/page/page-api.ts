import { DashboardRouteDefinition } from '../extension-api/types/navigation.js';
import { globalRegistry } from '../registry/global-registry.js';

globalRegistry.register('extensionRoutes', new Map<string, DashboardRouteDefinition>());

export function getExtensionRoutes(): Map<string, DashboardRouteDefinition> {
    return globalRegistry.get('extensionRoutes');
}

export function registerRoute(config: DashboardRouteDefinition) {
    if (config.path) {
        globalRegistry.get('extensionRoutes').set(config.path, config);
    }
}
