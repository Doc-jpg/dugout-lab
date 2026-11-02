export const APP_VERSION = '0.5.0';
declare const __BRAND_NAME__: string | undefined;
/** Name the build was made with (white-label); the in-app program name per team overrides it on screen. */
export const BUILD_BRAND = typeof __BRAND_NAME__ === 'string' ? __BRAND_NAME__ : 'Dugout Lab';
