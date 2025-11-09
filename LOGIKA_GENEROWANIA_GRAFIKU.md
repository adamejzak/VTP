# Logika generowania grafiku przez AI - Jak dobiera zmiany pracowników

## Przegląd systemu

System generuje grafik pracy dla całego miesiąca, przypisując pracowników do sklepów w konkretne dni. Algorytm działa w **trzech fazach**, przetwarzając każdy dzień miesiąca (z wyjątkiem niedziel).

---

## Faza 1: Przypisania główne (Main Store Assignments)

### Zasada podstawowa
Każdy pracownik ma przypisany **główny sklep**, w którym pracuje przez większość dni miesiąca.

### Przypisania główne pracowników:

| Pracownik | Główny sklep |
|-----------|--------------|
| **Adam** | Olsztyn Śródmieście |
| **Łukasz** | Olsztyn Jaroty |
| **Karolina** | Warszawa Mokotów |
| **Antoni** | Warszawa Puławska |
| **Czarek** | Warszawa Muranów |

### Jak to działa:

1. **Dla każdego dnia miesiąca** (od 1 do ostatniego dnia, pomijając niedziele):
   - System sprawdza każdy sklep
   - Znajduje pracownika przypisanego do tego sklepu jako głównego
   - Sprawdza, czy pracownik **nie ma dnia wolnego** w tym dniu
   - Jeśli nie ma dnia wolnego → przypisuje go do jego głównego sklepu

2. **Liczba godzin**:
   - System pobiera liczbę godzin pracy dla danego sklepu w danym dniu tygodnia
   - Każdy sklep ma zdefiniowane `workingHoursPerDay` dla każdego dnia tygodnia
   - Przykład: Sklep może mieć 8h w poniedziałek, 8h we wtorek, 6h w sobotę

3. **Rezultat**:
   - Adam pracuje w Olsztyn Śródmieście przez większość dni (gdy nie ma wolnego)
   - Łukasz pracuje w Olsztyn Jaroty przez większość dni
   - Karolina pracuje w Warszawa Mokotów przez większość dni
   - itd.

### Przykład:
```
Styczeń 2024, dzień 5 (piątek):
- Adam → Olsztyn Śródmieście (8h)
- Łukasz → Olsztyn Jaroty (8h)
- Karolina → Warszawa Mokotów (8h)
- Antoni → Warszawa Puławska (8h)
- Czarek → Warszawa Muranów (8h)
```

---

## Faza 2: Zastępstwa (Substitute Assignments)

### Kiedy potrzebne są zastępstwa?

Zastępstwa są potrzebne, gdy **główny pracownik sklepu ma dzień wolny**.

### Reguły zastępstw:

#### Zastępstwa dla sklepów w Olsztynie:
- **Sklep**: Olsztyn Śródmieście (główny: Adam) lub Olsztyn Jaroty (główny: Łukasz)
- **Zastępca**: **Szymon**
- **Kiedy**: Gdy Adam lub Łukasz mają dzień wolny

#### Zastępstwa dla sklepów w Warszawie:
- **Sklepy**: Warszawa Mokotów, Warszawa Muranów, Warszawa Puławska
- **Zastępca**: **Alina**
- **Kiedy**: Gdy Karolina, Czarek lub Antoni mają dzień wolny

### Jak to działa:

1. **Dla każdego dnia miesiąca**:
   - System sprawdza każdy sklep
   - Sprawdza, czy główny pracownik tego sklepu ma dzień wolny (z preferencji użytkownika)
   - Jeśli główny pracownik ma wolne:
     - Sprawdza, czy sklep już ma przypisanego kogoś (nie powinno być)
     - Jeśli sklep jest pusty → przypisuje odpowiedniego zastępcę:
       - Sklepy Olsztyn → **Szymon**
       - Sklepy Warszawa → **Alina**

2. **Liczba godzin zastępcy**:
   - Zastępca pracuje tyle samo godzin, ile normalnie pracowałby główny pracownik
   - System pobiera `workingHoursPerDay` dla danego sklepu i dnia tygodnia

### Przykład:
```
Styczeń 2024, dzień 10 (środa):
- Adam ma dzień wolny (z preferencji)
- System wykrywa: Olsztyn Śródmieście nie ma pracownika
- System przypisuje: Szymon → Olsztyn Śródmieście (8h)

- Karolina ma dzień wolny
- System wykrywa: Warszawa Mokotów nie ma pracownika
- System przypisuje: Alina → Warszawa Mokotów (8h)
```

---

## Faza 3: Specjalne zmiany Szymona (Szymon's Special Shifts)

### Kto to jest Szymon?

**Szymon** to specjalny pracownik, który:
- **Nie ma głównego sklepu**
- Może zastępować w sklepach Olsztyn (Faza 2)
- Ma **specjalne przypisania** gdy nie zastępuje

### Reguły specjalne dla Szymona:

#### Dni powszednie (poniedziałek - piątek):
- **Przypisanie**: **Biuro**
- **Liczba godzin**: 8h
- **Kiedy**: Gdy Szymon nie ma przypisania zastępczego w danym dniu

#### Soboty:
- **Przypisanie**: **Pod Telefonem**
- **Liczba godzin**: 8h
- **Kiedy**: Gdy Szymon nie ma przypisania zastępczego w sobotę

### Jak to działa:

1. **Dla każdego dnia miesiąca** (po fazie zastępstw):
   - System sprawdza, czy Szymon już ma jakieś przypisanie w tym dniu
   - Jeśli **nie ma przypisania** (nie zastępował nikogo):
     - **Sobota** → przypisuje "Pod Telefonem" (8h)
     - **Dni powszednie** → przypisuje "Biuro" (8h)
   - Jeśli **ma przypisanie** (zastępował kogoś) → nie dodaje dodatkowego przypisania

2. **Dni wolne Szymona**:
   - Jeśli Szymon ma dzień wolny w preferencjach → system nie przypisuje mu nic

### Przykład:
```
Styczeń 2024, dzień 5 (piątek):
- Szymon nie zastępował nikogo (wszyscy główni pracownicy pracują)
- System przypisuje: Szymon → Biuro (8h)

Styczeń 2024, dzień 6 (sobota):
- Szymon nie zastępował nikogo
- System przypisuje: Szymon → Pod Telefonem (8h)

Styczeń 2024, dzień 10 (środa):
- Szymon zastępował Adama w Olsztyn Śródmieście (8h)
- System NIE dodaje dodatkowego przypisania (Biuro)
- Szymon ma tylko jedno przypisanie: Olsztyn Śródmieście
```

---

## Reguły globalne

### 1. Niedziele są zawsze wolne
- **Wszystkie niedziele** są automatycznie pomijane
- Nikt nie jest przypisywany do pracy w niedziele
- System nie generuje żadnych przypisań dla niedziel

### 2. Dni wolne pracowników
- Jeśli pracownik ma dzień wolny w preferencjach → system go nie przypisuje
- Dla głównych pracowników → system próbuje znaleźć zastępcę
- Dla Szymona → jeśli ma wolne, nie dostaje ani zastępstwa, ani specjalnego przypisania

### 3. Jeden pracownik = jeden sklep dziennie
- Każdy sklep ma **maksymalnie jednego pracownika** w danym dniu
- Pracownik może być przypisany tylko do **jednego sklepu** w danym dniu
- Wyjątek: Szymon może mieć przypisanie zastępcze LUB specjalne, ale nie oba naraz

### 4. Liczba godzin zależy od sklepu i dnia tygodnia
- Każdy sklep ma zdefiniowane `workingHoursPerDay`:
  ```json
  {
    "monday": 8,
    "tuesday": 8,
    "wednesday": 8,
    "thursday": 8,
    "friday": 8,
    "saturday": 6,
    "sunday": 0
  }
  ```
- System automatycznie pobiera odpowiednią liczbę godzin dla danego dnia tygodnia

---

## Przykład pełnego miesiąca

### Styczeń 2024 (31 dni, 4 niedziele = 27 dni roboczych)

#### Dzień 1 (poniedziałek):
- Adam → Olsztyn Śródmieście (8h)
- Łukasz → Olsztyn Jaroty (8h)
- Karolina → Warszawa Mokotów (8h)
- Antoni → Warszawa Puławska (8h)
- Czarek → Warszawa Muranów (8h)
- Szymon → Biuro (8h) - nie zastępował nikogo

#### Dzień 5 (piątek):
- Adam → Olsztyn Śródmieście (8h)
- Łukasz → Olsztyn Jaroty (8h)
- Karolina → Warszawa Mokotów (8h)
- Antoni → Warszawa Puławska (8h)
- Czarek → Warszawa Muranów (8h)
- Szymon → Biuro (8h)

#### Dzień 6 (sobota):
- Adam → Olsztyn Śródmieście (6h) - mniej godzin w sobotę
- Łukasz → Olsztyn Jaroty (6h)
- Karolina → Warszawa Mokotów (6h)
- Antoni → Warszawa Puławska (6h)
- Czarek → Warszawa Muranów (6h)
- Szymon → Pod Telefonem (8h) - sobota = pod telefonem

#### Dzień 7 (niedziela):
- **WSZYSCY WOLNI** - niedziele są zawsze wolne

#### Dzień 10 (środa) - przykład z dniami wolnymi:
- **Adam ma dzień wolny** (z preferencji)
- Szymon → Olsztyn Śródmieście (8h) - **zastępstwo za Adama**
- Łukasz → Olsztyn Jaroty (8h)
- **Karolina ma dzień wolny**
- Alina → Warszawa Mokotów (8h) - **zastępstwo za Karolinę**
- Antoni → Warszawa Puławska (8h)
- Czarek → Warszawa Muranów (8h)
- **Szymon NIE dostaje Biuro** - już ma przypisanie zastępcze

#### Dzień 15 (poniedziałek):
- Adam → Olsztyn Śródmieście (8h)
- Łukasz → Olsztyn Jaroty (8h)
- Karolina → Warszawa Mokotów (8h)
- Antoni → Warszawa Puławska (8h)
- Czarek → Warszawa Muranów (8h)
- Szymon → Biuro (8h) - nie zastępował nikogo

---

## Podsumowanie logiki

### Kolejność przetwarzania:

1. **FAZA 1 - Przypisania główne**:
   - Dla każdego dnia: przypisz głównych pracowników do ich sklepów
   - Pomijaj dni wolne głównych pracowników

2. **FAZA 2 - Zastępstwa**:
   - Dla każdego dnia: sprawdź, czy główny pracownik ma wolne
   - Jeśli tak → przypisz odpowiedniego zastępcę:
     - Olsztyn → Szymon
     - Warszawa → Alina

3. **FAZA 3 - Specjalne zmiany Szymona**:
   - Dla każdego dnia: sprawdź, czy Szymon ma przypisanie
   - Jeśli nie ma → przypisz:
     - Sobota → Pod Telefonem
     - Dni powszednie → Biuro

### Kluczowe zasady:

✅ **Niedziele = zawsze wolne**  
✅ **Główny pracownik → główny sklep** (gdy nie ma wolnego)  
✅ **Zastępca → sklep głównego** (gdy główny ma wolne)  
✅ **Szymon → Biuro/Pod Telefonem** (gdy nie zastępuje)  
✅ **Jeden pracownik = jeden sklep dziennie**  
✅ **Liczba godzin zależy od sklepu i dnia tygodnia**

---

## Wyjątki i edge cases

### Co się dzieje, gdy:

1. **Wszyscy główni pracownicy mają wolne w tym samym dniu?**
   - System przypisze zastępców dla wszystkich sklepów
   - Szymon zastąpi w Olsztyn, Alina w Warszawie

2. **Szymon ma dzień wolny, ale powinien zastępować?**
   - System sprawdza preferencje Szymona
   - Jeśli ma wolne → nie przypisuje go jako zastępcy
   - Sklep pozostaje bez pracownika (może być problem)

3. **Alina ma dzień wolny, ale powinna zastępować?**
   - Podobnie jak Szymon - jeśli ma wolne, nie zostanie przypisana
   - Sklep pozostaje bez pracownika

4. **Nieznany pracownik (nie ma reguły biznesowej)?**
   - System używa fallback - przypisuje go jako pracownika bez głównego sklepu
   - Nie dostanie automatycznego przypisania

5. **Nieznany sklep?**
   - System używa fallback - tworzy kod sklepu z pierwszych 3 liter nazwy
   - Może nie mieć zdefiniowanych godzin pracy

---

## Ograniczenia algorytmu

### Obecne ograniczenia:

1. **Tylko przypisania STORE są zapisywane**
   - Przypisania muszą mieć `shiftType: 'STORE'` i `storeId` aby zostać zapisane
   - "Biuro" i "Pod Telefonem" **są zapisywane** - są traktowane jako normalne sklepy w bazie danych
   - Przypisania typu `DAY_OFF` (dni wolne) nie są zapisywane do bazy

2. **Brak zaawansowanego balansowania godzin**
   - System nie próbuje równomiernie rozłożyć godzin między pracownikami
   - Główni pracownicy mogą mieć więcej godzin niż zastępcy

3. **Brak obsługi wielu pracowników w jednym sklepie**
   - System zakłada, że każdy sklep ma dokładnie jednego pracownika dziennie
   - Nie obsługuje sytuacji, gdy sklep potrzebuje 2+ pracowników

4. **Proste zastępstwa**
   - Zastępstwa działają tylko dla głównych pracowników
   - Nie ma zastępstw dla zastępców (np. kto zastępuje Alinę, gdy ona ma wolne?)

---

## Przykład użycia w praktyce

### Scenariusz: Generowanie grafiku na styczeń 2024

**Wejście:**
- Miesiąc: 0 (styczeń)
- Rok: 2024
- Pracownicy: Adam, Łukasz, Karolina, Antoni, Czarek, Szymon, Alina
- Sklepy: Olsztyn Śródmieście, Olsztyn Jaroty, Warszawa Mokotów, Warszawa Puławska, Warszawa Muranów, Biuro, Pod Telefonem
- Dni wolne:
  - Adam: 10, 15, 20
  - Karolina: 5, 12

**Proces:**

1. **Dzień 1-4**: Wszyscy główni pracują w swoich sklepach, Szymon w Biuro
2. **Dzień 5**: Karolina ma wolne → Alina zastępuje w Warszawa Mokotów
3. **Dzień 6 (sobota)**: Wszyscy główni pracują (mniej godzin), Szymon → Pod Telefonem
4. **Dzień 7 (niedziela)**: Wszyscy wolni
5. **Dzień 10**: Adam ma wolne → Szymon zastępuje w Olsztyn Śródmieście
6. **Dzień 12**: Karolina ma wolne → Alina zastępuje w Warszawa Mokotów
7. **Dzień 15**: Adam ma wolne → Szymon zastępuje w Olsztyn Śródmieście
8. **Dzień 20**: Adam ma wolne → Szymon zastępuje w Olsztyn Śródmieście

**Wynik:**
- 27 dni roboczych (31 - 4 niedziele)
- Każdy sklep ma pokrycie przez głównego pracownika lub zastępcę
- Szymon ma mieszane przypisania: zastępstwa + Biuro/Pod Telefonem
- Alina zastępuje tylko w Warszawie, gdy główni mają wolne

