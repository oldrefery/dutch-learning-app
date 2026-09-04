import { TextThemed, TextProps } from './Themed'

export function MonoText(props: TextProps) {
  return (
    <TextThemed {...props} style={[props.style, { fontFamily: 'SpaceMono' }]} />
  )
}
