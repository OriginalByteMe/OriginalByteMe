export default function BackdropNocturneScene() {
  return (
    <div
      aria-hidden="true"
      data-backdrop-scene
      data-chapter="hero"
      data-testid="backdrop-scene"
      className="backdrop-nocturne-scene"
    >
      <div className="backdrop-perspective-grid" />
      <div className="backdrop-perspective-rings">
        <span />
        <span />
        <span />
      </div>

      <div className="backdrop-wave-contours">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="backdrop-ark-mark">
        <span className="backdrop-ark-layer backdrop-ark-layer-far" />
        <span className="backdrop-ark-layer backdrop-ark-layer-mid" />
        <span className="backdrop-ark-layer backdrop-ark-layer-front" />
      </div>

      <div className="backdrop-flecks">
        <span className="backdrop-fleck backdrop-fleck-a" />
        <span className="backdrop-fleck backdrop-fleck-b" />
        <span className="backdrop-fleck backdrop-fleck-c" />
        <span className="backdrop-fleck backdrop-fleck-d" />
        <span className="backdrop-fleck backdrop-fleck-e" />
        <span className="backdrop-fleck backdrop-fleck-f" />
        <span className="backdrop-fleck backdrop-fleck-g" />
      </div>
    </div>
  );
}
