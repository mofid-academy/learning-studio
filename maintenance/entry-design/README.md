# طراحی صفحهٔ انتخاب و ورود مفید

صفحهٔ انتخاب آزمون و استودیو و فرم ورود، پالت روشن قبلی مفید را با گرادینت Sfondo centrafit 2 ترکیب می‌کنند: سفید، سبز نعنایی و فیروزه‌ای با هاله‌های آبی یخی. گرادینت با CSS و بدون وابستگی جدید ساخته شده است. این اقتباس از مشخصات عمومی مرجع Bloom Field و طیف سفید، ‎#D0E9F0، ‎#AEECFF و ‎#B3FBFF استفاده می‌کند؛ کد نیازمند حساب مرجع دریافت نشده است. حرکت آرام پس‌زمینه و دنبال‌کردن موس حفظ شده‌اند.

دو لینک ورود در صفحهٔ اصلی همچنان Liquid Metal هستند. ShaderMount و liquidMetalFragmentShader واقعی Paper Shaders نسخهٔ 0.0.82 از commit `1923e9f536ea079e2a95d23291cbfacfd69d37f6` به ES modules تبدیل و در همان دامنه میزبانی شده‌اند. LICENSE و NOTICE حفظ شده‌اند. در نبود WebGL، حاشیهٔ متحرک CSS جایگزین می‌شود. لینک‌ها به جلوه وابسته نیستند. API پاک‌سازی `dispose()` است.

کارت و دکمهٔ فرم ورود حاشیهٔ ثابت دارند. نور گذرای قدیمی `.panel::after` غیرفعال است؛ تیرهای نور و لایه‌های Liquid Metal از فرم ورود حذف شده‌اند و mount فرم shader بارگذاری نمی‌کند. آیکون‌های آدمک و قفل و تصویر پس‌زمینهٔ ورودی‌ها، از جمله در حالت focus، حذف شده‌اند. گزینهٔ نمایش/پنهان‌کردن رمز حفظ شده است. لایه‌های کارت درون کادر بریده می‌شوند تا سرریز افقی رخ ندهد.

ظاهر ورود با جایگزینی محدود `MofidLogin` هنگام مونتاژ چهل فایل اصلی استودیو اعمال می‌شود. callback واقعی `onSubmit`، فراخوانی `mfApi('login', {username,password})`، کنترل نقش سوپرادمین، ذخیرهٔ نشست، خطا و شرط غیرفعال بودن دکمه بدون تغییرند. گزینهٔ عمومی ساخت حساب، ورود اجتماعی یا مسیر بازیابی رمز اضافه نشده است.

`entry-ui.js` هنگام mount فرم، پس‌زمینه و شیب ملایم کارت را فعال و هنگام unmount آن‌ها را پاک می‌کند. استایل‌ها به صفحهٔ انتخاب و کلاس موقت ورود محدودند. حرکت موس با requestAnimationFrame و همگرایی آرام انجام می‌شود؛ پس‌زمینه pointer-events ندارد. ترجیح کاهش حرکت، لمس، نمایشگر کوچک و غیرفعال بودن تب رعایت می‌شوند. جلوه‌ها هیچ مقدار فرم، توکن یا حافظهٔ حساب را نمی‌خوانند.

گزینه‌های پاسخ و دکمه‌های قبلی/بعدی در آزمون عمومی و آزمون تمرینی استودیو، حاشیهٔ درخشان سبز/سفید و هالهٔ داخلی دارند. این تغییر فقط CSS است؛ منطق پاسخ، تایمر، جابه‌جایی، رنگ حالت درست/نادرست و ثبت آزمون تغییر نکرده‌اند. `academy-assets/control-preview.html` یک نمونهٔ عمومی برای QA بدون محتوای آزمون واقعی، تایمر یا ثبت پاسخ است. فایل teaching-presentation.js و حرکت اسلایدها نیز تغییر نکرده‌اند.

مراجع طراحی:

- فایل‌های LiquidMetalButton و Sign In Card ارسالی کاربر.
- https://github.com/paper-design/shaders
- https://21st.dev/@brxscr/components/sfondo-centrafit-2
- https://21st.dev/community/gradients?preview=%2Fcommunity%2Fgradients%2Fsfondo-centrafit-2-d6bce123-912d-4401-8998-34ffcd10f2c6
- https://21st.dev/@designali-in/components/background-gradient-animation/background-gradient-animation
- https://ui.aceternity.com/components/background-gradient-animation
- https://21st.dev/@muhammad-binsalman/components/shiny-borders-button
