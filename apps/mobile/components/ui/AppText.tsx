import { Text, type TextProps, type TextStyle } from 'react-native';
import { surface, textStyles, type TextVariant } from '../../lib/theme';

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
};

/**
 * Texto padrão do app — aplica a Inter e a hierarquia de `textStyles`.
 * Limita a ampliação de fonte do sistema a 1,3× para não quebrar layouts.
 */
export function AppText({
  variant = 'body',
  color = surface.textPrimary,
  align,
  style,
  maxFontSizeMultiplier = 1.3,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[textStyles[variant], { color }, align ? { textAlign: align } : null, style]}
    />
  );
}
