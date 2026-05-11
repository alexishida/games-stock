/**
 * SectionIntro.tsx
 *
 * Componente de cabeçalho de seção reutilizável.
 * Exibe um título e uma descrição curta para introduzir o conteúdo
 * de cada seção dentro das configurações ou painéis da aplicação.
 */

import "./SectionIntro.css";

/**
 * Cabeçalho de seção com título e descrição.
 *
 * @param title       - Título principal da seção
 * @param description - Texto explicativo curto exibido abaixo do título
 */
export function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="section-intro">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
