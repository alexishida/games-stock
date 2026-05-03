import "./SectionIntro.css";

export function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="section-intro">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
