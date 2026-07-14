#include "stm32f4xx.h"
#include <stdint.h>

/*
    MCU: STM32F401RE
    Display: 7SEG-MPX4-CC Common Cathode

    Proteus connections:

    PA0 -> A
    PA1 -> B
    PA2 -> C
    PA3 -> D
    PA4 -> E
    PA5 -> F
    PA6 -> G
    PA7 -> DP

    PB0 -> Digit 1
    PB1 -> Digit 2
    PB2 -> Digit 3
    PB3 -> Digit 4

    Common Cathode:
    Segment ON = 1
    Digit ON   = 0
*/

#define SEG_MASK        0x00FFU
#define DIGIT_MASK      0x000FU

volatile uint8_t minute = 0;
volatile uint8_t second = 0;

volatile uint8_t disp_digit[4] = {0, 0, 0, 0};
volatile uint8_t active_digit = 0;

volatile uint16_t ms_counter = 0;

/* کدهای سون سگمنت کاتد مشترک */
const uint8_t seg_code[10] =
{
    0x3F,   /* 0 */
    0x06,   /* 1 */
    0x5B,   /* 2 */
    0x4F,   /* 3 */
    0x66,   /* 4 */
    0x6D,   /* 5 */
    0x7D,   /* 6 */
    0x07,   /* 7 */
    0x7F,   /* 8 */
    0x6F    /* 9 */
};

void Clock_Init_16MHz(void);
void GPIO_Init(void);
void TIM2_Init_1ms(void);
void Display_UpdateDigits(void);
void SevenSeg_RefreshOneDigit(void);

int main(void)
{
    Clock_Init_16MHz();
    GPIO_Init();

    Display_UpdateDigits();

    /*
        یک رقم را همین اول روشن می‌کنیم.
        اگر همین هم روشن نشود، یعنی مشکل از HEX، تغذیه، یا سیم‌کشی Proteus است.
    */
    SevenSeg_RefreshOneDigit();

    TIM2_Init_1ms();

    while (1)
    {
        /*
            عمداً خالی است.
            نه Delay داریم، نه حلقه تأخیری برای زمان.
            همه چیز با وقفه TIM2 انجام می‌شود.
        */
    }
}

void Clock_Init_16MHz(void)
{
    /*
        استفاده از HSI داخلی 16MHz
        بدون PLL
        در Proteus هم Clock Frequency را 16MHz بگذار.
    */

    RCC->CR |= RCC_CR_HSION;

    while ((RCC->CR & RCC_CR_HSIRDY) == 0)
    {
    }

    RCC->CFGR &= ~RCC_CFGR_SW;
    RCC->CFGR |= RCC_CFGR_SW_HSI;

    while ((RCC->CFGR & RCC_CFGR_SWS) != RCC_CFGR_SWS_HSI)
    {
    }
}

void GPIO_Init(void)
{
    /*
        فعال کردن کلاک GPIOA و GPIOB
    */
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOBEN;

    /*
        PA0 تا PA7 خروجی
        هر پایه دو بیت در MODER دارد.
        01 یعنی Output
    */
    GPIOA->MODER &= ~(0xFFFFU);
    GPIOA->MODER |=  (0x5555U);

    /*
        PB0 تا PB3 خروجی
    */
    GPIOB->MODER &= ~(0x00FFU);
    GPIOB->MODER |=  (0x0055U);

    /*
        Output Push Pull
    */
    GPIOA->OTYPER &= ~SEG_MASK;
    GPIOB->OTYPER &= ~DIGIT_MASK;

    /*
        No Pull-up / No Pull-down
    */
    GPIOA->PUPDR &= ~(0xFFFFU);
    GPIOB->PUPDR &= ~(0x00FFU);

    /*
        سرعت خروجی Low
    */
    GPIOA->OSPEEDR &= ~(0xFFFFU);
    GPIOB->OSPEEDR &= ~(0x00FFU);

    /*
        سگمنت‌ها خاموش
    */
    GPIOA->ODR &= ~SEG_MASK;

    /*
        رقم‌ها خاموش
        چون کاتد مشترک است، 1 یعنی خاموش
    */
    GPIOB->ODR |= DIGIT_MASK;
}

void TIM2_Init_1ms(void)
{
    /*
        فعال کردن کلاک TIM2
    */
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;

    /*
        خاموش کردن تایمر قبل از تنظیم
    */
    TIM2->CR1 = 0;

    /*
        کلاک تایمر = 16MHz

        16MHz / ((1599 + 1) * (9 + 1)) = 1000Hz

        یعنی هر 1ms یک وقفه
    */
    TIM2->PSC = 1599;
    TIM2->ARR = 9;

    TIM2->CNT = 0;

    /*
        آپدیت رجیسترها
    */
    TIM2->EGR = TIM_EGR_UG;

    /*
        پاک کردن فلگ‌ها
    */
    TIM2->SR = 0;

    /*
        فعال کردن وقفه Update
    */
    TIM2->DIER |= TIM_DIER_UIE;

    /*
        فعال کردن وقفه در NVIC
    */
    NVIC_SetPriority(TIM2_IRQn, 1);
    NVIC_EnableIRQ(TIM2_IRQn);

    /*
        روشن کردن تایمر
    */
    TIM2->CR1 |= TIM_CR1_CEN;
}

void Display_UpdateDigits(void)
{
    disp_digit[0] = minute / 10;    /* دهگان دقیقه */
    disp_digit[1] = minute % 10;    /* یکان دقیقه */
    disp_digit[2] = second / 10;    /* دهگان ثانیه */
    disp_digit[3] = second % 10;    /* یکان ثانیه */
}

void SevenSeg_RefreshOneDigit(void)
{
    uint8_t number;
    uint8_t pattern;

    /*
        1) خاموش کردن همه رقم‌ها
        چون رقم‌ها Active Low هستند، 1 یعنی خاموش
    */
    GPIOB->ODR |= DIGIT_MASK;

    /*
        2) انتخاب عدد مربوط به رقم فعلی
    */
    number = disp_digit[active_digit];
    pattern = seg_code[number];

    /*
        روشن کردن DP رقم دوم برای جدا کردن دقیقه و ثانیه
        خروجی به شکل MM.SS دیده می‌شود.
        چون قطعه 7SEG-MPX4-CC دو نقطه واقعی ندارد.
    */
    if (active_digit == 1)
    {
        pattern |= 0x80;
    }
    else
    {
        pattern &= 0x7F;
    }

    /*
        3) قرار دادن الگوی سگمنت‌ها روی PA0 تا PA7
    */
    GPIOA->ODR &= ~SEG_MASK;
    GPIOA->ODR |= pattern;

    /*
        4) روشن کردن فقط رقم فعلی
        کاتد مشترک است، پس 0 یعنی روشن
    */
    GPIOB->ODR &= ~(1U << active_digit);

    /*
        5) رفتن به رقم بعدی
    */
    active_digit++;

    if (active_digit >= 4)
    {
        active_digit = 0;
    }
}

void TIM2_IRQHandler(void)
{
    /*
        بررسی فلگ وقفه تایمر
    */
    if ((TIM2->SR & TIM_SR_UIF) != 0)
    {
        /*
            پاک کردن فلگ وقفه
        */
        TIM2->SR &= ~TIM_SR_UIF;

        /*
            Multiplexing
            هر 1ms یک رقم عوض می‌شود.
        */
        SevenSeg_RefreshOneDigit();

        /*
            شمارش زمان
            1000 وقفه 1ms = یک ثانیه
        */
        ms_counter++;

        if (ms_counter >= 1000)
        {
            ms_counter = 0;

            second++;

            if (second >= 60)
            {
                second = 0;
                minute++;

                if (minute >= 60)
                {
                    minute = 0;
                }
            }

            Display_UpdateDigits();
        }
    }
}
