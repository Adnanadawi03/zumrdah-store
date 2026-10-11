# المتجر — دليل التشغيل (نسخة صفحات منفصلة)

كل صفحة صارت ملف مستقل بدل تطبيق صفحة واحدة. بدون أي مكتبات خارجية، بس Node.js 18 أو أحدث.

## هيكل الصفحات
**صفحات العميل:** `index.html` (الرئيسية), `shop.html` (المتجر), `product.html?id=` (صفحة منتج), `cart.html` (السلة), `checkout.html` (إتمام الشراء), `contact.html` (تواصل معنا).
**صفحات التاجر:** `admin/login.html` (دخول), `admin/products.html`, `admin/orders.html`, `admin/delivery.html`, `admin/settings.html`.
**ملفات مشتركة:** `style.css`، `app.js` (السلة والأدوات المشتركة)، `admin/admin.js` (حماية دخول التاجر)، `logo.png`، `favicon.png`.

## تشغيل تجريبي على جهازك
```
ADMIN_PASSWORD=كلمة_سر_قوية node server.js        # Mac / Linux
set ADMIN_PASSWORD=كلمة_سر_قوية && node server.js  # Windows (cmd)
```
افتح http://localhost:3000 ، ولوحة التاجر: http://localhost:3000/admin/login.html

## النشر (مثال: Render.com أو Railway أو أي VPS)
1. ارفع المجلد على GitHub (خلّي `.gitignore` مثل ما هو).
2. أنشئ Web Service جديد: **Build**: فاضي، **Start**: `node server.js`.
3. المتغيرات (Environment):
   - `ADMIN_PASSWORD` = كلمة سر التاجر (8 خانات على الأقل) — **إجباري**
   - `DATA_DIR` = مسار القرص الدائم، مثلاً `/var/data`
4. **مهم:** أضف Persistent Disk واربطه على نفس مسار `DATA_DIR`. بدونه الاستضافات المجانية بتمسح المنتجات والطلبات مع كل إعادة تشغيل.
5. اربط دومينك (HTTPS بيجي تلقائياً من الاستضافة).

## ملاحظات
- السلة الآن محفوظة بمتصفح العميل نفسه (localStorage)، وبتضل موجودة حتى لو سكّر المتصفح وبعدها فتحه.
- كل بيانات المتجر في ملف واحد: `DATA_DIR/db.json` — خذ منه نسخة احتياطية بشكل دوري.
- أسعار الطلبات (المنتجات والإضافات والتوصيل والخصم) بتنحسب على السيرفر، فما حدا يقدر يغيّر السعر من المتصفح.
- دخول التاجر عبر `/admin/login.html`، والجلسة أسبوع. المحاولات الغلط محدودة (8 كل 15 دقيقة).
- الحجم المناسب: مئات المنتجات وآلاف الطلبات. لو كبر المتجر كثير، انقل التخزين لقاعدة بيانات (SQLite/PostgreSQL).
