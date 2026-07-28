import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { IconWeight } from 'phosphor-react-native';

import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CarIcon } from 'phosphor-react-native/src/icons/Car';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { ConfettiIcon } from 'phosphor-react-native/src/icons/Confetti';
import { CpuIcon } from 'phosphor-react-native/src/icons/Cpu';
import { GiftIcon } from 'phosphor-react-native/src/icons/Gift';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { IdentificationCardIcon } from 'phosphor-react-native/src/icons/IdentificationCard';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { ListIcon } from 'phosphor-react-native/src/icons/List';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MapTrifoldIcon } from 'phosphor-react-native/src/icons/MapTrifold';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PhoneIcon } from 'phosphor-react-native/src/icons/Phone';
import { ScooterIcon } from 'phosphor-react-native/src/icons/Scooter';
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { TaxiIcon } from 'phosphor-react-native/src/icons/Taxi';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { XIcon } from 'phosphor-react-native/src/icons/X';

export interface IconProps {
  size?: number;
  color?: string;
  weight?: IconWeight;
  style?: StyleProp<ViewStyle>;
}

export type IconComponent = React.FC<IconProps>;

/**
 * Every icon in the app renders through this file so the "thin lined" look
 * (Phosphor's `thin` weight — a true 1px stroke, unlike Ionicons' bulkier
 * "outline" set) is the default everywhere without each call site repeating it.
 */
function themed(Base: React.FC<IconProps>): IconComponent {
  return function ThemedIcon({ weight = 'thin', ...rest }) {
    return <Base weight={weight} {...rest} />;
  };
}

export const IconHouse = themed(HouseIcon);
export const IconMapPin = themed(MapPinIcon);
export const IconMapTrifold = themed(MapTrifoldIcon);
export const IconList = themed(ListIcon);
export const IconCpu = themed(CpuIcon);
export const IconUser = themed(UserIcon);
export const IconCamera = themed(CameraIcon);
export const IconPencilSimple = themed(PencilSimpleIcon);
export const IconIdentificationCard = themed(IdentificationCardIcon);
export const IconImage = themed(ImageIcon);
export const IconTaxi = themed(TaxiIcon);
export const IconScooter = themed(ScooterIcon);
export const IconCar = themed(CarIcon);
export const IconGift = themed(GiftIcon);
export const IconSignOut = themed(SignOutIcon);
export const IconCheck = themed(CheckIcon);
export const IconX = themed(XIcon);
export const IconCaretLeft = themed(CaretLeftIcon);
export const IconCaretRight = themed(CaretRightIcon);
export const IconStar = themed(StarIcon);
export const IconShareNetwork = themed(ShareNetworkIcon);
export const IconConfetti = themed(ConfettiIcon);
export const IconPhone = themed(PhoneIcon);
