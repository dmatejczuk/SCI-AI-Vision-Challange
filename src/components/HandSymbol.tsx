export function HandSymbol({ fist = false }: { fist?: boolean }) {
  return (
    <svg viewBox="0 0 120 140" fill="none" aria-hidden="true">
      <path
        d={
          fist
            ? 'M30 60 V47 Q30 37 40 37 Q47 37 49 44 V37 Q49 27 59 27 Q67 27 69 36 Q71 28 79 30 Q88 31 88 42 Q98 36 103 45 L107 75 Q110 91 94 108 L91 122 H46 L43 104 Q23 90 18 72 Q15 58 24 56 Q28 56 30 60 Z'
            : 'M31 73 L29 38 Q28 27 38 26 Q47 25 49 37 L51 64 L50 21 Q50 11 59 11 Q69 11 69 23 L70 63 L74 29 Q75 18 84 20 Q94 22 91 34 L87 68 L94 46 Q97 36 105 40 Q113 44 109 55 L101 88 Q97 101 89 109 L87 126 H47 L45 108 Q29 96 20 79 Q12 66 20 61 Q27 57 31 73 Z'
        }
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d={fist ? 'M31 61 Q48 56 62 64 L68 76 L51 85' : 'M51 81 Q68 75 81 85'}
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
