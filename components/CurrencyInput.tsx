"use client";

import { forwardRef } from "react";
import { maskCentavosBRL } from "@/lib/moeda";

type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** String mascarada ("1.234,56") mantida no estado do formulário. */
  value: string;
  /** Recebe sempre a string já mascarada. Use parseValorBRL() no submit. */
  onChange: (masked: string) => void;
};

/**
 * Campo de valor em R$ com máscara automática: sempre vírgula decimal e 2 casas,
 * preenchendo os centavos da direita para a esquerda. Impede salvar sem vírgula.
 */
const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput({ value, onChange, placeholder = "0,00", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(maskCentavosBRL(e.target.value))}
        placeholder={placeholder}
        {...rest}
      />
    );
  },
);

export default CurrencyInput;
