export const convertYesNoToBoolean = (value: string): boolean | null => {
  switch (value) {
    case 'yes':
      return true;
    case 'no':
      return false;
    default:
      return null;
  }
};
