import React from 'react';
import { TactileButton, TactileButtonProps } from './TactileButton';

export interface TactileTouchableProps extends TactileButtonProps {}

/**
 * TactileTouchable: Drop-in replacement for TouchableOpacity that adds
 * Android native material ripple, instantaneous 0ms feedback, micro-press spring bounce,
 * and tactile mechanical haptics.
 */
export const TactileTouchable = React.forwardRef<any, TactileTouchableProps>(
  (props, ref) => {
    return <TactileButton ref={ref} {...props} />;
  }
);

TactileTouchable.displayName = 'TactileTouchable';

export const PressableRipple = TactileTouchable;
export const TouchableRipple = TactileTouchable;
export const TouchableOpacity = TactileTouchable;

export default TactileTouchable;

