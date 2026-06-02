/* Icono de Albus (public/albusv2.svg). Se usa como imagen para conservar el color
   y el stroke originales (es un PNG embebido de dos tonos; enmascararlo lo aplanaba). */
export default function AlbusIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/albusv2.svg"
      alt=""
      aria-hidden="true"
      className={`albus-icon ${className}`}
      style={{ height: size, width: "auto" }}
    />
  );
}
