export const lab = {
  movePatch: 'Kliknij lub przeciągnij ramkę. Po aktywowaniu obrazu przesuwaj ją strzałkami.',
  patch: 'Fragment obrazu',
  patchSize: 'Rozmiar fragmentu',
  zoom: 'POWIĘKSZENIE',
  zoomIn: 'Powiększ piksele',
  zoomOut: 'Pomniejsz piksele',
  pixelModes: ['KOLOR', 'R', 'G', 'B', 'JASNOŚĆ', 'PO NORMALIZACJI'],
  patchHistogram: 'Histogram zaznaczonego fragmentu',
  brightness: 'Jasność umowna: 0,2126 R + 0,7152 G + 0,0722 B',
  normalizedPatch:
    'Siatka pokazuje kanał R rzeczywistego tensora (−1 do 1), w najbliższej pozycji modelu odpowiadającej każdemu pikselowi źródła. Szare pola z kreską są poza kadrowaniem. Zmiana rozmiaru i odbicie zmieniają współrzędne; interpolacja miesza piksele. Poniżej odczytasz wszystkie trzy kanały i wzór x / 127,5 − 1.',
  whatFeatures: 'Co to właściwie są cechy?',
  featureIntro:
    'Na początku są piksele: wiele liczb R, G i B. Ekstraktor przekształca je w nową reprezentację. Klasyfikator otrzymuje zestaw liczb, a nie zdjęcie. Te liczby nazywamy cechami.',
  finger: 'Czy jedna cecha oznacza jeden palec?',
  distributed:
    'Nie. Nie przypisujemy pojedynczej wartości do kciuka ani koloru skóry. Znaczenie jest rozłożone między wiele wartości. Nie możemy przypisać decyzji jednej konkretnej cesze semantycznej.',
  deeper: 'TROCHĘ GŁĘBIEJ',
  featureDeeper:
    'Przesunięcie dłoni może zmienić wiele pikseli. Reprezentacja cech może zmienić się mniej — ale nie musi. Sprawdź to na dwóch obrazach. Ekstraktor tworzy reprezentację przydatną do rozróżniania przykładów; nie jest to kompresja pliku ani obraz, który da się odczytać jak zdjęcie.',
  excerpt: 'Fragment rzeczywistych wartości; animacja ilustruje przepływ, nie kolejne neurony.',
  compare: 'PORÓWNAJ DWA OBRAZY',
  compareHelp:
    'Najpierw pokaż ten sam gest w innym miejscu. Potem porównaj OPEN z FIST. Wynik może zależeć także od tła i oświetlenia — podobieństwo nie jest gwarantowane.',
  vectors: 'Jak zmieniły się cechy?',
  difference: 'RÓŻNICA',
  cosine: 'Podobieństwo cosinusowe',
  distance: 'Odległość euklidesowa',
  metricHelp:
    'Odległość 0 oznacza identyczne wektory; mniejsza oznacza bliższe reprezentacje. Cosinus mieści się od −1 do 1; 1 oznacza ten sam kierunek. To nie jest procent pewności klasyfikatora. Dla zerowego wektora cosinus jest nieokreślony.',
  pixelDifference: 'Średnia bezwzględna różnica RGB przygotowanych obrazów (0–255)',
  scales:
    'Różnica pikseli i odległość cech mają inne skale i jednostki. Ich wielkości nie są bezpośrednio porównywalne.',
  why: 'Dlaczego model wybrał',
  uncertain: 'Model nie jest pewny',
  closeScores:
    'OPEN i FIST otrzymały podobne wyniki (różnica poniżej 20 punktów procentowych). Sprawdźmy dane.',
  belowThreshold: 'Najwyższy wynik nie osiągnął progu sterowania. Sprawdźmy dane.',
  higher: 'Wybrana klasa ma najwyższy wynik softmax. Wynik nie gwarantuje poprawnego rozpoznania.',
  tie: 'Wyniki są równe. Reguła rozstrzygająca remis wybiera OPEN.',
  mechanism:
    'Klasyfikator Dense mnoży cechy przez wagi wyuczone na Twoich przykładach, dodaje bias i przelicza dwie sumy przez softmax. Wygrywa największy wynik. Nie wyszukuje najbliższego zdjęcia i nie używa PCA.',
  map: 'Gdzie znalazł się Twój obraz?',
  yourImage: 'TWÓJ OBRAZ',
  all: 'Wszystkie próbki',
  onlyOpen: 'Tylko OPEN',
  onlyFist: 'Tylko FIST',
  neighbors: 'Najbardziej podobne przykłady',
  distances: 'Średnia odległość do przykładów',
  distanceHelp:
    'Obliczenia wykorzystują wszystkie cechy oryginalnych próbek, bez powielania ich przy balansowaniu danych. Zdjęcia treningowe nie są przechowywane. To opis reprezentacji, a nie mechanizm decyzji Dense.',
  closer: 'Mniejsza średnia odległość w pełnej przestrzeni cech:',
  equalDistances: 'Obie klasy mają taką samą średnią odległość.',
  perturb: 'Które fragmenty obrazu mają znaczenie?',
  perturbHelp:
    'Ukrywamy po jednym fragmencie centralnego kadru kolorem RGB(128, 128, 128) i ponownie uruchamiamy model. Mierzymy zmianę wyniku pierwotnie wybranej klasy. Oryginalny obraz pozostaje bez zmian.',
  perturbRun: 'SPRAWDŹ WPŁYW FRAGMENTÓW',
  cancel: 'ANULUJ EKSPERYMENT',
  perturbLegend:
    'Czerwony: wynik spadł po zasłonięciu. Niebieski: wzrósł. Nasycenie oznacza wielkość zmiany względem największej zmiany w tym eksperymencie.',
  perturbCaveat:
    'To wrażliwość na konkretny sposób zasłonięcia. Nie dowodzi, że model rozumie obiekt ani że „patrzy” w to miejsce. Nowa szara plama sama też zmienia obraz.',
  technical: 'TECHNICZNIE',
  occlusion:
    'Occlusion sensitivity: wynik bazowy minus wynik po zasłonięciu, dla stałej klasy i modelu. Każda próba zasłania tylko jeden region. Brak aktualizacji GestureController i brak zdarzeń gry.',
  grid: 'Siatka regionów',
  baseline: 'Przed zasłonięciem',
  masked: 'Po zasłonięciu',
  change: 'Zmiana (przed − po), punkty procentowe',
  final: 'Dlaczego więc',
  preview: 'To podgląd kopii GestureController. Ta analiza nie wykonała skoku w grze.',
  trick: 'SPRÓBUJ OSZUKAĆ MODEL',
  trickHelp:
    'Zmieniaj kąt dłoni, odległość, położenie, częściowe zasłonięcie lub tło. Gdy wynik jest błędny lub niepewny, zatrzymaj obraz i sprawdź dlaczego.',
  add: 'DODAJ TEN PRZYKŁAD DO DANYCH',
  label: 'Jaki gest naprawdę pokazujesz? Wybierz poprawną etykietę, niezależnie od wyniku modelu.',
  retrain: 'DODAJ I WYTRENUJ PONOWNIE',
  addedHelp:
    'Zapisujemy tylko wektor cech z tej klatki. Po treningu pokaż gest ponownie w teście. Nie zapisujemy zdjęcia.',
  cap: 'Osiągnięto limit przykładów tej klasy.',
} as const;
