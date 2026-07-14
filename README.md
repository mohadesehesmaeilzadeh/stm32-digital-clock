# STM32 Digital Clock on 4-Digit Seven-Segment Display

![MCU](https://img.shields.io/badge/MCU-STM32F401RE-blue)
![Display](https://img.shields.io/badge/Display-7SEG--MPX4--CC-green)
![Timer](https://img.shields.io/badge/Timer-TIM2-orange)
![Language](https://img.shields.io/badge/Language-C-lightgrey)

## Overview

This project implements a digital clock using an STM32F401RE microcontroller and a 4-digit common-cathode seven-segment display. The clock shows time in `MM.SS` format, where the decimal point after the second digit is used as the separator between minutes and seconds.

The final application logic is written with direct register access. TIM2 generates a 1 ms interrupt, and that interrupt is used for both display multiplexing and time counting. No delay loop is used for the clock timing.

## Features

- Counts from `00.00` to `59.59`, then rolls over to `00.00`.
- Uses TIM2 update interrupt every 1 ms.
- Refreshes the four display digits using multiplexing.
- Drives segment pins directly from GPIOA.
- Selects active display digit using GPIOB.
- Uses the internal 16 MHz HSI clock for stable Proteus simulation.
- Includes STM32CubeIDE project files and a Proteus simulation project.

## Screenshots

### Proteus Simulation Circuit

![Proteus simulation circuit](docs/images/proteus-simulation.png)

This screenshot shows the complete Proteus schematic. The STM32F401RE drives a `7SEG-MPX4-CC` four-digit common-cathode display. PA0 to PA7 are connected to the segment lines through current-limiting resistors, and PB0 to PB3 select the active digit. The running simulation shows the clock value on the multiplexed display.

### STM32CubeMX Pinout Configuration

![STM32CubeMX pinout configuration](docs/images/cubemx-pinout.png)

This screenshot shows the STM32CubeMX pinout setup for the STM32F401RETx. GPIO pins PA0 to PA7 are configured as outputs for the seven-segment lines, while PB0 to PB3 are configured as outputs for digit selection. SWD pins are left enabled for debugging/programming.

### STM32CubeMX Clock Configuration

![STM32CubeMX clock configuration](docs/images/cubemx-clock-config.png)

This screenshot shows the CubeMX clock tree. The project was originally generated with CubeMX, but the final application code configures the clock directly in `main.c` and uses the internal 16 MHz HSI clock for simpler and more stable Proteus simulation timing.

## Hardware

| Component | Purpose |
| --- | --- |
| STM32F401RE | Main microcontroller |
| 7SEG-MPX4-CC | Four-digit common-cathode seven-segment display |
| 330 ohm resistors | Segment current limiting |
| 10k ohm resistor | Reset pull-up |
| 3.3 V supply | MCU supply |
| GND | Common ground |

## Pin Connections

### Segment Pins

| STM32 Pin | Display Pin |
| --- | --- |
| PA0 | A |
| PA1 | B |
| PA2 | C |
| PA3 | D |
| PA4 | E |
| PA5 | F |
| PA6 | G |
| PA7 | DP |

### Digit Select Pins

The display is common cathode, so digit select pins are active low.

| STM32 Pin | Digit |
| --- | --- |
| PB0 | Digit 1 |
| PB1 | Digit 2 |
| PB2 | Digit 3 |
| PB3 | Digit 4 |

## Architecture

```text
          +----------------------+
          | Internal HSI 16 MHz  |
          +----------+-----------+
                     |
                     v
          +----------------------+
          | RCC clock control    |
          +----------+-----------+
                     |
        +------------+-------------+
        |                          |
        v                          v
+---------------+          +----------------+
| GPIOA PA0-PA7 |          | TIM2 1 ms IRQ  |
| segment data  |          +-------+--------+
+-------+-------+                  |
        |                          v
        v                  +----------------+
+---------------+          | TIM2_IRQHandler|
| 7-seg segments|          +-------+--------+
+---------------+                  |
                                   v
                         +--------------------+
                         | Refresh one digit  |
                         | Count milliseconds |
                         | Update MM.SS       |
                         +---------+----------+
                                   |
                                   v
                         +--------------------+
                         | GPIOB PB0-PB3      |
                         | active-low digit   |
                         +--------------------+
```

## Program Flow

```text
Reset
  |
  v
Clock_Init_16MHz()
  |
  v
GPIO_Init()
  |
  v
Display_UpdateDigits()
  |
  v
TIM2_Init_1ms()
  |
  v
Main loop stays empty
  |
  v
TIM2 interrupt every 1 ms:
  - clear timer interrupt flag
  - refresh one display digit
  - increment millisecond counter
  - every 1000 ms, increment seconds
  - every 60 seconds, increment minutes
  - every 60 minutes, reset to 00.00
```

## Important Source Files

| File | Description |
| --- | --- |
| `Core/Src/main.c` | Main direct-register application code, GPIO setup, TIM2 setup, display refresh, and interrupt handler |
| `Core/Src/stm32f4xx_it.c` | CubeMX interrupt file; TIM2 handler is commented out to avoid duplicate definition |
| `Core/Src/gpio.c` | CubeMX-generated GPIO initialization, not used by the final direct-register flow |
| `Core/Src/tim.c` | CubeMX-generated TIM2 initialization, not used by the final direct-register flow |
| `Core/Startup/startup_stm32f401retx.s` | Startup code and interrupt vector table |
| `STM32F401RETX_FLASH.ld` | Flash linker script |
| `DigitalClock.ioc` | STM32CubeMX configuration file |
| `DigitalClock.pdsprj` | Proteus simulation project |

## Build Instructions

### STM32CubeIDE

1. Open STM32CubeIDE.
2. Select `File > Import > Existing Projects into Workspace`.
3. Choose the project folder.
4. Build the project.
5. The generated HEX file should be available under `Debug/DigitalClock.hex`.

### Proteus Simulation

1. Open `DigitalClock.pdsprj` in Proteus.
2. Confirm the STM32F401RE program file points to the generated `DigitalClock.hex`.
3. Set the MCU clock frequency to `16 MHz`.
4. Run the simulation.
5. The display should count in `MM.SS` format.

## Notes

- The Proteus display uses `7SEG-MPX4-CC`, so segment pins turn on with logic `1`, and digit select pins turn on with logic `0`.
- The decimal point of the second digit is used as the separator because the selected display part does not provide a true colon.
- For real hardware, consider using transistor drivers for the digit select lines instead of driving all digit commons directly from MCU pins.

## Credits

Course project for a microcontroller/microprocessor class.

Authors:

- Mohadeseh Esmaeilzadeh
