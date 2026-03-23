/**
 * Drop-in replacement for @gorhom/bottom-sheet that works with Expo Go.
 * Uses absolutely-positioned overlay + Animated (no Modal, no reanimated, no worklets).
 * Avoiding Modal prevents the native window-layer bleed that blocks touches on other screens.
 */
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import {
  View,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  PanResponder,
  ScrollView,
  BackHandler,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native'

export type SimpleBottomSheetRef = {
  expand: () => void
  close: (onDone?: () => void) => void
}

type Props = {
  index?: number
  snapPoints?: (string | number)[]
  enablePanDownToClose?: boolean
  backgroundStyle?: ViewStyle
  handleIndicatorStyle?: ViewStyle
  onChange?: (index: number) => void
  children?: React.ReactNode
}

const SCREEN_HEIGHT = Dimensions.get('window').height

function toPixels(snap: string | number): number {
  if (typeof snap === 'number') return snap
  if (typeof snap === 'string' && snap.endsWith('%')) {
    return SCREEN_HEIGHT * (parseFloat(snap) / 100)
  }
  return parseFloat(String(snap))
}

const SimpleBottomSheet = forwardRef<SimpleBottomSheetRef, Props>((props, ref) => {
  const {
    snapPoints = ['50%'],
    enablePanDownToClose = true,
    backgroundStyle,
    handleIndicatorStyle,
    onChange,
    children,
  } = props

  // Use the largest snap point as the sheet height
  const sheetHeight = Math.max(...snapPoints.map(toPixels))

  const [visible, setVisible] = useState(false)
  const translateY = useRef(new Animated.Value(sheetHeight)).current

  function openSheet() {
    setVisible(true)
    translateY.setValue(sheetHeight)
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start()
    onChange?.(0)
  }

  function closeSheet(onDone?: () => void) {
    Animated.timing(translateY, {
      toValue: sheetHeight,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false)
      onChange?.(-1)
      onDone?.()
    })
  }

  useImperativeHandle(ref, () => ({ expand: openSheet, close: closeSheet }))

  // Handle Android hardware back button while sheet is open
  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet()
      return true
    })
    return () => sub.remove()
  }, [visible])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enablePanDownToClose,
      onMoveShouldSetPanResponder: (_, g) => enablePanDownToClose && g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > sheetHeight * 0.3 || g.vy > 0.5) {
          closeSheet()
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start()
        }
      },
    }),
  ).current

  if (!visible) return null

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={enablePanDownToClose ? closeSheet : undefined}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: sheetHeight,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            overflow: 'hidden',
            transform: [{ translateY }],
          },
          backgroundStyle,
        ]}
      >
        {/* Drag handle */}
        <View
          style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}
          {...panResponder.panHandlers}
        >
          <View
            style={[
              { width: 40, height: 4, borderRadius: 2, backgroundColor: '#606060' },
              handleIndicatorStyle,
            ]}
          />
        </View>

        {children}
      </Animated.View>
    </View>
  )
})

SimpleBottomSheet.displayName = 'SimpleBottomSheet'

/** Plain View child — matches @gorhom BottomSheetView */
function SimpleBottomSheetView({
  children,
  style,
}: {
  children?: React.ReactNode
  style?: ViewStyle
}) {
  return <View style={[{ flex: 1 }, style]}>{children}</View>
}

/** ScrollView child — matches @gorhom BottomSheetScrollView */
function SimpleBottomSheetScrollView({ children, ...rest }: ScrollViewProps) {
  return <ScrollView {...rest}>{children}</ScrollView>
}

export {
  SimpleBottomSheet as default,
  SimpleBottomSheetView as BottomSheetView,
  SimpleBottomSheetScrollView as BottomSheetScrollView,
}
