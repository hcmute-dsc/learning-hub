/**
 * The club's ">DSC_" mark (same files as hcmute-dsc.io.vn, copied to public/brand),
 * with the light or dark version picked by the system color scheme.
 */
export function BrandLogo({ height = 32 }: { height?: number }) {
  return (
    <picture>
      <source srcSet="/brand/hcmute-dsc-mark-dark.png" media="(prefers-color-scheme: dark)" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no resizing needed */}
      <img
        src="/brand/hcmute-dsc-mark.png"
        alt="HCMUTE DSC"
        height={height}
        style={{ height, width: 'auto' }}
      />
    </picture>
  );
}
