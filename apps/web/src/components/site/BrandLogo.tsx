/**
 * The club's ">DSC_" mark (same files as hcmute-dsc.io.vn, copied to public/brand).
 * Both versions are in the page and CSS shows one, so the logo follows the color scheme
 * picked in /settings, not only the device setting.
 */
export function BrandLogo({ height = 32 }: { height?: number }) {
  const style = { height, width: 'auto' };
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no resizing needed */}
      <img
        src="/brand/hcmute-dsc-mark.png"
        alt="HCMUTE DSC"
        height={height}
        style={style}
        className="dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no resizing needed */}
      <img
        src="/brand/hcmute-dsc-mark-dark.png"
        alt="HCMUTE DSC"
        height={height}
        style={style}
        className="hidden dark:block"
      />
    </>
  );
}
