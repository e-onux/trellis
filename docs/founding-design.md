# Agentic LLM Coder Framework
## Vibe Coding İçin Kontrol Edilebilir, Kanıta Dayalı ve Yaşayan Yazılım Mimarisi

> **Belge durumu:** Erken konsept ve tasarım notları  
> **Tarih:** 7 Haziran 2026  
> **Amaç:** Şu ana kadar ortaya konan fikirleri, problem tanımını, çözüm ilkelerini, önerilen mimariyi ve piyasadaki yakın yaklaşımları tek bir başlangıç belgesinde toplamak  
> **Not:** Bu belge nihai standart değildir. Yeni fikirler geldikçe genişletilecek yaşayan bir tasarım belgesidir.

---

## 1. Özet

Bu framework fikri, agentic LLM coding ve vibe coding süreçlerinde ortaya çıkan temel bir soruna odaklanır:

- Kod üretmek giderek kolaylaşmaktadır.
- Buna karşılık kodun neden o şekilde yazıldığı, hangi varsayımlara dayandığı, hangi kaynaklardan beslendiği ve ne zaman yeniden değerlendirilmesi gerektiği çoğu projede kayıt altına alınmamaktadır.
- Agent'lar kısa vadede çalışan özellikler üretirken uzun vadede kodun kontrolsüz büyümesine, mimari tutarlılığın bozulmasına ve maintainability'nin çökmesine yol açabilmektedir.
- Testler çoğu zaman yalnızca teknik ekip tarafından görülebilen dosyalarda kalmaktadır.
- Kullanıcı, bir özelliğin hangi girdilerle ne üretmesi gerektiğini ve gerçekten doğru çalışıp çalışmadığını doğrudan görememektedir.
- Sohbet geçmişi ve tek seferlik prompt'lar proje hafızası olmaya uygun değildir.
- Mevcut agentic coding sistemleri çoğunlukla ne yapılacağını ve nasıl uygulanacağını yönetmekte, fakat neden bu kararın verildiğini, hangi kanıta dayandığını, kararın ne zaman eskimiş sayılacağını ve yazılımın semantik olarak kontrol edilebilir kalıp kalmadığını bütüncül biçimde yönetmemektedir.
- Eklenti, modül, provider veya adapter gibi genişletmelerde güncellenmesi zorunlu registry, config, kılavuz, test manifesti ve capability kayıtları zamanla unutulabilmektedir. Framework bu entegrasyon noktalarını dizin bazlı, açık ve doğrulanabilir sözleşmeler haline getirmelidir.

Önerilen sistemin temel yaklaşımı şudur:

> Her anlamlı yazılım yeteneği küçük, sınırlı sorumluluğa sahip, anlaşılır girdileri ve beklenen çıktıları bulunan, bağımsız çalıştırılabilen, otomatik test edilebilen ve kullanıcı tarafından görsel bir test ekranında doğrulanabilen bir capability olarak tanımlanmalıdır.

Bu yaklaşım, yalnızca yeni bir coding agent üretmeyi değil, mevcut agent'ların üzerinde çalışabileceği agent-independent bir repository governance, specification, evidence, testing ve lifecycle standardı oluşturmayı hedefler.

---

## 2. Problem Tanımı

### 2.1. Vibe coding'in temel riski

Vibe coding sırasında kullanıcı doğal dille istek verir, agent kod üretir ve özellik kısa sürede çalışır hale gelir. Bu süreç ilk aşamada çok verimlidir. Ancak proje büyüdükçe şu sorunlar ortaya çıkar:

1. Aynı sorumluluk farklı dosyalara dağılır.
2. Yeni kod mevcut yapıya uymadan eklenir.
3. Fonksiyonlar, servisler ve modüller sürekli genişler.
4. Bağımlılıklar görünmez biçimde artar.
5. Aynı iş kuralı birden fazla yerde tekrar edilir.
6. Agent geçmiş kararları bilmeden yeni kararlar verir.
7. Refactor ihtiyacı ertelenir.
8. Testler eksik, yüzeysel veya implementation'a fazla bağımlı olur.
9. Bir noktadan sonra küçük değişiklikler beklenmeyen yerleri bozar.
10. Uygulamanın maintainability'si çöker.

Bu sorun yalnızca “kötü kod yazılması” değildir. Asıl sorun, agent'ın karar verme ve kod üretme sürecinin sınırlandırılmamış olmasıdır.

### 2.2. Sohbet geçmişinin proje hafızası olamaması

Bir coding agent ile yapılan konuşmalarda çok sayıda önemli bilgi oluşur:

- Neden belirli bir teknoloji seçildi?
- Hangi alternatifler değerlendirildi?
- Neden belirli bir mimari yapı tercih edildi?
- Hangi iş kuralı hangi varsayıma dayanıyor?
- Hangi akademik çalışma, benchmark veya resmi dokümantasyon kararı destekliyor?
- Hangi koşul değişirse karar yeniden değerlendirilmelidir?
- Agent hangi alanlarda karar verebilir?
- Hangi değişikliklerde insan onayı zorunludur?

Bu bilgilerin yalnızca chat history içinde kalması sürdürülebilir değildir. Projenin kendisi, kendi karar hafızasını taşımalıdır.

### 2.3. Testlerin kullanıcıdan gizli kalması

Klasik projelerde testler genellikle aşağıdaki biçimlerde bulunur:

```text
tests/
├── Unit/
├── Integration/
├── Functional/
└── E2E/
```

Bunlar geliştirici açısından anlamlıdır. Ancak kullanıcı açısından asıl soru şudur:

> “Bu özellik hangi girdilerde ne üretmeli ve şu anda gerçekten doğru mu çalışıyor?”

Kullanıcı `login.spec.ts` veya `ShippingCostServiceTest.php` görmek istemez. Kullanıcı şu yetenekleri görmek ister:

- Kullanıcı kaydı
- Kullanıcı girişi
- Kargo ücreti hesaplama
- Ödeme doğrulama
- Şifre sıfırlama
- Sipariş oluşturma

Bu nedenle testlerin yalnızca teknik dosyalar değil, ürün yetenekleri çevresinde görünür hale getirilmesi gerekir.

---

## 3. Framework'ün Ana Hedefleri

Framework aşağıdaki hedefleri birlikte gerçekleştirmelidir:

### 3.1. Kalıcı proje hafızası

Projenin teknik, ürünsel ve mimari kararları repository içinde saklanmalıdır.

### 3.2. Kararların gerekçelendirilmesi

Her önemli karar için şu bilgiler tutulmalıdır:

- Karar nedir?
- Neden alınmıştır?
- Hangi alternatifler değerlendirilmiştir?
- Hangi kanıtlar kararı desteklemektedir?
- Hangi varsayımlar altında geçerlidir?
- Riskleri nelerdir?
- Hangi koşulda yeniden değerlendirilmelidir?
- Hangi karar veya dosyalar bundan etkilenmektedir?

### 3.3. Kontrollü kod büyümesi

Kod yeni özelliklerle sınırsız biçimde genişlememelidir. Her capability'nin ölçülebilir bütçeleri olmalıdır.

### 3.4. Semantik modülerlik

Modüller yalnızca teknik katmanlara göre değil, anlamlı ürün veya domain yeteneklerine göre ayrılmalıdır.

### 3.5. Çalıştırılabilir specification

Her capability, insan tarafından okunabilir ve makine tarafından çalıştırılabilir bir sözleşmeye sahip olmalıdır.

### 3.6. Kullanıcı tarafından doğrulanabilirlik

Her capability için, kullanıcının anlamlı input verip expected output ile actual output'u karşılaştırabileceği standart bir test ekranı oluşturulmalıdır.

### 3.7. Agent bağımsızlığı

Framework mümkün olduğunca Claude Code, Codex, Cursor, Copilot, Kiro, Windsurf, Gemini CLI ve gelecekteki agent'larla çalışabilmelidir.

### 3.8. Teknolojik eskimeye karşı dayanıklılık

Framework yalnızca bugünkü teknolojiyi belgelememeli, teknolojik gelişmeler karşısında upgrade ve refactor kararlarını tetikleyebilmelidir.

### 3.9. Kanıta dayalı geliştirme

Teknik seçimler akademik makale, benchmark, resmi dokümantasyon, güvenlik rehberi veya gerçek proje gözlemi gibi kaynaklarla ilişkilendirilebilmelidir.

### 3.10. Eksiksiz extension, eklenti ve modül kaydı

Her yeni eklenti, modül, provider, adapter, connector veya genişletme noktası için hangi dosyaların mutlaka güncellenmesi gerektiği ilgili dizinde açıkça tanımlanmalıdır.

Bu tanım yalnızca ekip hafızasına bırakılamaz. Registry, config, config schema, environment örnekleri, kılavuzlar, capability contract, test cockpit, permission, route, migration, changelog ve removal adımları gerektiğinde zorunlu kayıt noktaları olarak belirtilmelidir.


---

## 4. Temel İlke

Framework'ün merkezindeki temel kural:

> Uygulamadaki her anlamlı yetenek, sınırlı sorumluluğa sahip bağımsız bir capability contract olarak tanımlanmalı, standart bir arayüzden çalıştırılabilmeli ve beklenen çıktı ile gerçek çıktı insan tarafından karşılaştırılabilmelidir.

Bu ilke şu iki alanı birleştirir:

1. **Repository governance**
   - Kararlar
   - Kaynaklar
   - Mimari sınırlar
   - Teknoloji yaşam döngüsü
   - Refactor ve upgrade politikaları

2. **Executable capabilities**
   - Input sözleşmeleri
   - Output sözleşmeleri
   - Örnekler
   - Invariant'lar
   - Otomatik testler
   - Kullanıcı test ekranı
   - Bağımlılık ve karmaşıklık bütçeleri

---

## 5. Tek Bootstrap Markdown Dosyası

Framework başlangıçta tek bir Markdown dosyasıyla kurulabilir.

Örnek isimler:

```text
AGENTIC-FRAMEWORK.md
FRAMEWORK.md
BOOTSTRAP.md
PROJECT-CONSTITUTION.md
```

Bu dosya agent'a şu görevleri verir:

1. Repository'yi analiz et.
2. Projenin mevcut teknoloji ve mimari yapısını çıkar.
3. Eksik governance dizinlerini oluştur.
4. Projenin constitution ve engineering principles dosyalarını üret.
5. Mevcut teknik kararları tespit et.
6. Her önemli karar için ADR oluştur.
7. Kararların dayandığı kaynakları sınıflandır.
8. Kararların varsayımlarını, risklerini ve review trigger'larını yaz.
9. Uygulamadaki anlamlı capability'leri çıkar.
10. Her capability için input, output, örnek ve invariant sözleşmesi oluştur.
11. Her capability'yi otomatik ve manuel olarak test edilebilir hale getir.
12. Standart capability test ekranını oluştur.
13. Modül büyüklüğü ve bağımlılık bütçelerini tanımla.
14. Agent-specific instruction adaptörlerini üret.
15. Kalite kapılarını CI/CD sürecine bağla.
16. Gelecekteki upgrade ve refactor değerlendirmeleri için lifecycle dosyaları oluştur.

Tek dosya bootstrap için yeterlidir. Ancak proje çalışmaya başladıktan sonra tüm bilgiyi tek dosyada tutmak doğru değildir. Büyük bir manifesto zamanla context yükünü artırır ve agent'ın önemli kuralları kaçırmasına neden olabilir. Bu nedenle bootstrap dosyası, bilgiyi amaç odaklı küçük dosyalara ayırmalıdır.

---

## 6. Önerilen Repository Yapısı

```text
/
├── AGENTS.md
├── AGENTIC-FRAMEWORK.md
│
├── governance/
│   ├── constitution.md
│   ├── engineering-principles.md
│   ├── agent-authority.md
│   ├── definition-of-done.md
│   ├── change-policy.md
│   └── human-approval-policy.md
│
├── product/
│   ├── vision.md
│   ├── constraints.md
│   ├── domain-model.md
│   ├── terminology.md
│   ├── non-goals.md
│   └── user-journeys/
│
├── tech/
│   ├── overview.md
│   ├── architecture-map.md
│   ├── technology-radar.md
│   ├── upgrade-policy.md
│   ├── refactoring-policy.md
│   ├── dependency-policy.md
│   └── decisions/
│       ├── index.md
│       ├── ADR-0001-example.md
│       └── ADR-0002-example.md
│
├── sources/
│   ├── MANIFEST.md
│   ├── bibliography.yaml
│   ├── papers/
│   ├── benchmarks/
│   ├── official-docs/
│   ├── evaluations/
│   └── licenses/
│
├── extensions/
│   ├── EXTENSIONS.md
│   ├── extension-registry.yaml
│   ├── extension-contract.schema.json
│   └── types/
│       ├── plugin.md
│       ├── module.md
│       ├── provider.md
│       └── adapter.md
│
├── capabilities/
│   ├── index.md
│   ├── capability-map.yaml
│   └── calculate-shipping-cost/
│       ├── capability.md
│       ├── contract.yaml
│       ├── examples/
│       ├── tests/
│       ├── adapter/
│       └── evidence/
│
├── quality/
│   ├── testing-strategy.md
│   ├── security-policy.md
│   ├── performance-budgets.md
│   ├── architecture-invariants.md
│   ├── maintainability-policy.md
│   └── quality-gates.yaml
│
├── lifecycle/
│   ├── review-calendar.md
│   ├── technical-debt.md
│   ├── migration-plans/
│   ├── deprecations/
│   ├── upgrade-reviews/
│   └── refactor-proposals/
│
├── adapters/
│   ├── claude/
│   ├── codex/
│   ├── cursor/
│   ├── copilot/
│   ├── kiro/
│   └── generic/
│
├── tools/
│   ├── validator/
│   ├── capability-runner/
│   ├── dependency-analyzer/
│   └── test-cockpit/
│
└── templates/
    ├── adr-template.md
    ├── source-template.md
    ├── capability-template.md
    ├── evaluation-template.md
    ├── migration-template.md
    ├── refactor-proposal-template.md
    ├── extension-registration-template.md
    └── extension-removal-template.md
```

---

## 7. Governance Katmanı

### 7.1. `constitution.md`

Projenin değişmez veya yüksek öncelikli ilkelerini içerir.

Örnek:

```markdown
# Project Constitution

1. Her özellik bir capability contract ile ilişkilendirilmelidir.
2. Testi ve observable output'u olmayan özellik tamamlanmış sayılamaz.
3. Yeni bir bağımlılık gerekçesiz eklenemez.
4. Mimari kararlar ADR ile kaydedilmelidir.
5. Kritik iş kuralları yalnızca UI veya controller içinde bulunamaz.
6. Capability bütçesi aşılırsa yeni özellik eklemeden önce split proposal hazırlanmalıdır.
7. İnsan onayı gerektiren kararlar agent tarafından tek başına uygulanamaz.
```

### 7.2. `agent-authority.md`

Agent'ın yetki sınırlarını tanımlar.

Örnek:

```markdown
## Agent'ın otomatik yapabilecekleri

- Test eklemek
- Dokümantasyonu güncellemek
- Küçük refactor yapmak
- Mevcut capability içinde uyumlu değişiklik yapmak
- Eksik örnek senaryoları önermek

## İnsan onayı gerekenler

- Ana framework veya veritabanı değişikliği
- Yeni dış servis ekleme
- Kullanıcı verisi saklama politikasını değiştirme
- Güvenlik sınırlarını değiştirme
- Public API breaking change
- Capability bölme veya birleştirme
- Lisans riski taşıyan kaynak ekleme
```

### 7.3. `definition-of-done.md`

Agent'ın yalnızca kod yazmayı tamamlanma saymasını engeller.

Bir özellik aşağıdakiler olmadan tamamlanmış sayılamaz:

```text
[ ] Capability contract mevcut
[ ] Input şeması mevcut
[ ] Output şeması mevcut
[ ] En az bir normal senaryo mevcut
[ ] En az bir hata senaryosu mevcut
[ ] Invariant'lar tanımlı
[ ] Otomatik testler geçiyor
[ ] Kullanıcı test ekranından çalıştırılabiliyor
[ ] Bağımlılık bütçesi aşılmıyor
[ ] Architecture invariants korunuyor
[ ] İlgili karar ve kaynak dokümanları güncellendi
[ ] Regresyon kontrolü tamamlandı
[ ] Gerekliyse kullanıcı onayı alındı
```

---

## 8. Karar Yönetimi

### 8.1. Architecture Decision Record

Her önemli teknik karar için ADR tutulmalıdır.

Örnek:

```markdown
# ADR-0004: PostgreSQL Kullanılması

## Durum

Accepted

## Bağlam

Uygulama ilişkisel veri bütünlüğü ve transaction desteği gerektiriyor.

## Karar

Ana veri deposu olarak PostgreSQL kullanılacaktır.

## Değerlendirilen Alternatifler

- MySQL
- MongoDB
- DynamoDB

## Gerekçe

- İlişkisel model ihtiyacı
- Transaction gereksinimi
- Takım deneyimi
- Ekosistem olgunluğu

## Varsayımlar

- Yazma hacmi saniyede 5.000 işlemi aşmayacak.
- İlişkisel tutarlılık öncelikli kalacak.
- Operasyonel ekip PostgreSQL yönetebilecek.

## Riskler

- Yatay ölçekleme ihtiyacında ek mimari gerekebilir.
- JSON ağırlıklı kullanım ilişkisel modelin avantajını azaltabilir.

## Yeniden Değerlendirme Tetikleyicileri

- Yazma hacminin belirlenen sınırı aşması
- Operasyonel maliyetin bütçeyi aşması
- Ana kullanım modelinin event-stream yapısına dönüşmesi
- Kullandığımız PostgreSQL sürümünün destek dışı kalması

## Destekleyen Kaynaklar

- source-001
- source-002
```

### 8.2. Karar yaşam döngüsü

Bir karar şu statülere sahip olabilir:

```text
proposed
accepted
experimental
deprecated
superseded
rejected
under-review
```

Karar değiştiğinde eski ADR silinmemelidir. Yeni ADR eski kararı `superseded` olarak işaretlemelidir.

### 8.3. Review mekanizması

Örnek metadata:

```yaml
review:
  interval: 12 months
  triggers:
    - major-version-release
    - security-advisory
    - maintenance-status-changed
    - operational-cost-exceeded
    - performance-budget-exceeded
    - architecture-assumption-invalidated
```

---

## 9. Kaynak ve Kanıt Yönetimi

### 9.1. Neden kaynak katmanı gerekir?

Teknik kararların yalnızca “agent böyle önerdi” biçiminde kalması güvenilir değildir. Kararın hangi bilgiye dayandığı izlenebilmelidir.

Kaynak tipleri:

- Akademik makale
- Standart
- Resmi teknik dokümantasyon
- Güvenlik rehberi
- Benchmark
- Deney sonucu
- İç proje ölçümü
- Kullanıcı araştırması
- Incident raporu
- Yasal veya düzenleyici belge

### 9.2. `sources/MANIFEST.md`

Bu dosya kaynakların nasıl saklanacağını açıklar:

```markdown
# Source Manifest

- Kaynaklar benzersiz kimliğe sahip olmalıdır.
- Karara etkisi açıkça yazılmalıdır.
- Kaynağın lisansı kontrol edilmelidir.
- Yerel kopya yalnızca izin veriliyorsa saklanmalıdır.
- Link, DOI, sürüm ve erişim tarihi kaydedilmelidir.
- Kaynak ile onu kullanan ADR veya capability arasında çift yönlü ilişki kurulmalıdır.
```

### 9.3. Örnek kaynak kaydı

```yaml
id: source-001
title: Example Paper
authors:
  - Example Author
published: 2025
type: academic-paper
doi: 10.0000/example
url: https://example.org/paper
license: CC-BY-4.0
local_copy: null
sha256: null

supports:
  - ADR-0004
  - capability-order-validation

relevance:
  claim: "Selected architecture improves consistency under the defined workload."
  confidence: medium
  limitations:
    - "Benchmark environment differs from production."

last_verified: 2026-06-07
```

### 9.4. PDF ve DOCX saklama politikası

PDF veya DOCX dosyaları varsayılan olarak repository'ye kopyalanmamalıdır.

Yerel kopya yalnızca şu durumlarda tutulmalıdır:

- Kaynağın lisansı izin veriyorsa
- Doküman kullanıcıya aitse
- Doküman açık lisanslıysa
- Kurumsal kullanım izni varsa
- Uzun vadeli erişim için yasal arşivleme gerekiyorsa

Aksi halde bibliyografik metadata, URL, DOI, sürüm, checksum ve erişim tarihi saklanmalıdır.

---

## 10. Executable Capability Contract

### 10.1. Capability nedir?

Capability, kullanıcı veya sistem açısından anlamlı, sınırlı ve gözlemlenebilir bir yetenektir.

Örnekler:

- Kargo ücreti hesaplama
- Kullanıcı kaydı
- Şifre sıfırlama
- Sipariş toplamını hesaplama
- Dosya formatını dönüştürme
- E-posta teslim durumunu kontrol etme
- Bir LLM isteğini sınıflandırma
- Bir ödeme isteğini doğrulama
- Bir background job'ı çalıştırma

Capability yalnızca bir class veya fonksiyon değildir. Bir davranış sözleşmesidir.

### 10.2. Önerilen klasör yapısı

```text
capabilities/
└── calculate-shipping-cost/
    ├── capability.md
    ├── contract.yaml
    ├── examples/
    │   ├── domestic-standard.yaml
    │   ├── domestic-express.yaml
    │   └── invalid-weight.yaml
    ├── tests/
    ├── adapter/
    └── evidence/
```

### 10.3. Örnek `contract.yaml`

```yaml
id: calculate-shipping-cost
title: Calculate shipping cost
owner: checkout
version: 1.0.0
status: active

intent:
  description: >
    Calculate shipping cost from destination,
    package weight and delivery method.

responsibility:
  does:
    - calculate shipping price
    - estimate delivery duration

  does_not:
    - create orders
    - process payments
    - send emails

inputs:
  destination:
    type: country-code
    required: true

  weight_kg:
    type: number
    minimum: 0.01
    maximum: 30

  method:
    type: enum
    values:
      - standard
      - express

outputs:
  amount:
    type: money

  estimated_days:
    type: integer

examples:
  - name: Domestic standard delivery
    input:
      destination: DE
      weight_kg: 2
      method: standard
    expected:
      amount:
        currency: EUR
        value: 4.99
      estimated_days: 3

invariants:
  - amount.value >= 0
  - estimated_days >= 1

dependencies:
  - pricing-table
  - destination-zone-resolver

budgets:
  max_files: 12
  max_lines_of_code: 800
  max_direct_dependencies: 3
  max_public_operations: 1
  max_cyclomatic_complexity: 10

verification:
  unit: required
  contract: required
  property_based: required
  integration: optional
  visual: not-applicable
  user_demo: required

review:
  interval: 6 months
  triggers:
    - pricing-model-changed
    - carrier-api-changed
    - dependency-budget-exceeded
```

---

## 11. Capability'lerden Üretilebilecek Çıktılar

Framework bir capability contract'tan otomatik olarak şunları üretebilmelidir:

- Unit test iskeleti
- Contract test
- Property-based test
- Integration test senaryosu
- API örneği
- Başarılı senaryo
- Hata senaryosu
- Edge case senaryoları
- Kullanıcı test formu
- Dokümantasyon
- Dependency graph
- Capability sağlık raporu
- Test coverage özeti
- CI kalite kapısı
- Agent için implementation görevleri
- Değişiklik sonrası regresyon kontrol listesi

Bu yaklaşım, specification, test, dokümantasyon ve kullanıcı doğrulamasını aynı kaynaktan türetmeyi hedefler.

---

## 12. Standart Capability Test Ekranı

Framework'ün önemli parçalarından biri, development veya controlled staging ortamında çalışan standart bir test ekranıdır.

Örnek rota:

```text
/__capabilities
```

### 12.1. Genel ekran

```text
Application Capabilities

✓ Kullanıcı kaydı
✓ E-posta doğrulama
✓ Kullanıcı girişi
! Şifre sıfırlama
✓ Kargo ücreti hesaplama
✗ PayPal ödemesi
```

### 12.2. Capability detay ekranı

```text
Kargo Ücreti Hesaplama

Input
Destination: [DE]
Weight:      [2.0]
Method:      [Standard ▼]

[Run]

Expected Output
€4.99
3 days

Actual Output
€4.99
3 days

Status: PASS
```

### 12.3. Ekranda bulunabilecek bilgiler

- Capability açıklaması
- Input alanları
- Input doğrulama kuralları
- Beklenen output
- Gerçek output
- PASS veya FAIL durumu
- Örnek senaryolar
- Edge case'ler
- Hata senaryoları
- Son çalıştırma tarihi
- Son başarılı commit
- İlk bozulduğu commit
- Doğrudan bağımlılıklar
- Bağımlı capability'ler
- Test coverage
- Performance bütçesi
- Son agent değişikliği
- İlgili ADR'ler
- İlgili kaynaklar
- Kullanıcı onay durumu
- Regression geçmişi

### 12.4. Test ekranının amacı

Bu ekran yalnızca developer debugging aracı değildir. Ürün davranışının açık bir yüzeyidir.

Kullanıcı şu soruları cevaplayabilmelidir:

- Bu özellik tam olarak ne yapıyor?
- Hangi girdileri kabul ediyor?
- Hangi çıktıyı üretmesi bekleniyor?
- Hata durumunda ne yapıyor?
- Şu anda doğru çalışıyor mu?
- Son değişiklik bu özelliği bozdu mu?
- Sonucu onaylamam gerekiyor mu?

---

## 13. Kod Şişmesini Önleme Mekanizması

### 13.1. Salt satır sayısı yeterli değildir

Kod şişmesi yalnızca çok fazla satır olması değildir. Şunlar da şişmenin göstergesidir:

- Bir capability'nin çok fazla sorumluluğu olması
- Çok fazla doğrudan bağımlılık
- Birden fazla domain'i yönetmesi
- Çok fazla public operation
- Çok sayıda veri tablosuna erişmesi
- Çok sayıda dış servisle konuşması
- Değişiklik nedenlerinin birbirinden farklı olması
- Sık sık başka capability'lerin davranışını bozması

### 13.2. Capability bütçeleri

Örnek:

```yaml
budgets:
  max_files: 12
  max_lines_of_code: 800
  max_direct_dependencies: 5
  max_public_operations: 3
  max_database_tables: 2
  max_external_services: 1
  max_cyclomatic_complexity: 12
  max_change_reasons: 1
```

Bütçeler teknolojiye ve proje ölçeğine göre ayarlanabilir.

### 13.3. Semantik sorumluluk sınırı

Her capability açıkça ne yaptığını ve ne yapmadığını belirtmelidir.

```yaml
responsibility:
  does:
    - calculate shipping price
    - estimate delivery duration

  does_not:
    - create orders
    - process payments
    - send notifications
```

### 13.4. Agent karar akışı

Yeni davranış geldiğinde agent şu kontrolü yapmalıdır:

```text
Yeni davranış mevcut capability'nin "does" alanına uyuyor mu?

Evet:
  Capability bütçelerini kontrol et.
  Uygunsa mevcut capability'yi genişlet.

Hayır:
  Yeni capability öner.

Mevcut capability bütçeyi aşıyor mu?

Evet:
  Implementation yapma.
  Önce split proposal oluştur.
  Etki analizi üret.
  Migration planı hazırla.
```

### 13.5. Kod üretmeme yükümlülüğü

Framework'ün önemli ilkelerinden biri:

> Agent'a yalnızca kod üretme yetkisi değil, mimari sınırlar aşıldığında kod üretmeme yükümlülüğü de verilmelidir.

Bu, agent'ın her talebe doğrudan yeni kod eklemesini engeller.

---

## 14. Extension Registration Contract

### 14.1. Çözülen problem

Bir eklenti veya modül eklemek çoğu projede yalnızca yeni bir klasör ve implementation oluşturmak değildir.

Yeni geliştirme çoğu zaman aşağıdaki yerlerin bir bölümüne kaydedilmelidir:

- Ana plugin, module veya provider registry
- Dependency injection container
- Service provider listesi
- Route tanımları
- Menü ve navigation yapısı
- Permission ve role tanımları
- Event, hook veya middleware registry
- Config dosyaları
- Config schema
- `.env.example` veya benzeri environment örnekleri
- Migration, fixture ve seed kayıtları
- CLI command registry
- API dokümantasyonu
- Kullanıcı kılavuzu
- Developer guide
- Capability map
- Test cockpit manifesti
- Changelog
- Upgrade guide
- Build, packaging veya deployment config
- Monitoring ve observability tanımları

İlk eklenti geliştirilirken bu adımlar bilinmektedir. Ancak daha sonra farklı bir geliştirici veya agent yeni bir eklenti eklediğinde bazı kayıt noktaları kolayca atlanabilir.

Bunun sonucunda kod repository içinde mevcut olur, fakat uygulamaya eksik bağlanır. Eklenti belirli ortamlarda görünmez, config kabul edilmez, kılavuzda yer almaz, test ekranında çalıştırılamaz veya kaldırılırken geride orphan kayıtlar bırakır.

### 14.2. Temel kural

> Her extension point, yeni bir extension eklemek, değiştirmek veya kaldırmak için güncellenmesi zorunlu dosyaları ilgili dizinde bulunan açık bir Markdown sözleşmesiyle tanımlamalıdır.

Önerilen varsayılan dosya adı:

```text
EXTENSIONS.md
```

Bağlama göre kullanılabilecek alternatifler:

```text
ADDING-A-MODULE.md
PLUGIN-CONTRACT.md
REGISTRATION.md
INTEGRATION-CHECKLIST.md
```

### 14.3. Kurallar ilgili dizine yakın tutulmalıdır

Ana uygulama düzeyindeki extension sistemi:

```text
/
├── EXTENSIONS.md
├── extension-registry.yaml
└── modules/
```

Belirli bir subsystem'e ait extension sistemi:

```text
payments/
├── EXTENSIONS.md
├── provider-registry.yaml
└── providers/
    ├── stripe/
    └── paypal/
```

Root seviyesindeki dosya genel kuralları tanımlar. Alt dizindeki dosya, o extension point'e özgü ek kuralları tanımlar.

Agent en yakın `EXTENSIONS.md` dosyasını ve onun üst dizinlerindeki geçerli genel kuralları okumalıdır.

### 14.4. Örnek `EXTENSIONS.md`

```markdown
# Payment Provider Extension Contract

Bu dizine yeni bir payment provider eklendiğinde aşağıdaki adımların tamamı uygulanmalıdır.

## Zorunlu implementation

1. `payments/providers/<provider>/`
   - Provider implementation
   - Provider-specific config
   - Error mapping
   - Unit ve contract testleri

## Zorunlu kayıt noktaları

2. `payments/provider-registry.yaml`
   - Provider kimliğini ekle
   - Factory veya adapter sınıfını kaydet
   - Desteklenen capability'leri tanımla

3. `config/payment.schema.yaml`
   - Provider config alanlarını ekle
   - Required ve optional alanları tanımla
   - Secret alanlarını işaretle

4. `.env.example`
   - Gerekli environment variable'ları ekle
   - Gerçek secret ekleme

5. `docs/payments/providers.md`
   - Kurulum adımlarını ekle
   - Kullanım örneğini ekle
   - Limitasyonları açıkla

6. `capabilities/payment-processing/contract.yaml`
   - Yeni provider'ın etkilediği senaryoları ekle

7. `test-cockpit/manifest.yaml`
   - Provider test senaryolarını kaydet

8. `CHANGELOG.md`
   - Yeni provider desteğini ekle

## Zorunlu kontroller

- Provider registry kaydı var
- Config schema geçerli
- Environment variable dokümante
- Contract testleri geçiyor
- En az bir hata senaryosu mevcut
- Kullanıcı test ekranında çalıştırılabiliyor
- Removal ve cleanup adımları tanımlı
```

### 14.5. Makine tarafından okunabilir extension sözleşmesi

Markdown insan tarafından okunacak ana kılavuzdur. Bunun yanında otomatik doğrulama için bir YAML veya JSON sözleşmesi tutulabilir.

```yaml
id: payment-provider
title: Payment provider extension
root: payments/providers

registration:
  required_updates:
    - path: payments/provider-registry.yaml
      operation: add-provider
      required: true

    - path: config/payment.schema.yaml
      operation: add-config-schema
      required: true

    - path: .env.example
      operation: document-environment
      required_if: extension.requires_environment

    - path: docs/payments/providers.md
      operation: add-documentation
      required: true

    - path: capabilities/payment-processing/contract.yaml
      operation: update-capability
      required: true

    - path: test-cockpit/manifest.yaml
      operation: register-test-scenarios
      required: true

    - path: CHANGELOG.md
      operation: add-entry
      required: true

required_artifacts:
  - implementation
  - unit-tests
  - contract-tests
  - error-scenarios
  - configuration-example
  - user-documentation

removal:
  required_updates:
    - payments/provider-registry.yaml
    - config/payment.schema.yaml
    - .env.example
    - docs/payments/providers.md
    - capabilities/payment-processing/contract.yaml
    - test-cockpit/manifest.yaml
    - CHANGELOG.md

validation:
  command: framework extension validate payment-provider
```

### 14.6. Extension türleri

Bu sözleşme farklı genişletme biçimlerinde kullanılabilir:

- Plugin
- Module
- Provider
- Adapter
- Driver
- Connector
- Theme
- Widget
- CLI command
- Event listener
- Middleware
- Authentication mechanism
- Payment method
- Shipping method
- Storage backend
- Importer
- Exporter
- AI model provider
- Agent tool integration
- Workflow step

Her extension türü kendi zorunlu kayıt noktalarına sahip olabilir.

### 14.7. Agent iş akışı

Agent yeni bir extension eklemeden önce:

1. En yakın `EXTENSIONS.md` dosyasını bulur.
2. Üst dizinlerdeki geçerli genel extension kurallarını okur.
3. Machine-readable extension contract'ı yükler.
4. Güncellenmesi zorunlu dosyaların listesini çıkarır.
5. Dosya yollarının hâlâ geçerli olup olmadığını kontrol eder.
6. Implementation ile birlikte tüm kayıt noktalarını günceller.
7. Zorunlu test, dokümantasyon ve config artifact'larını oluşturur.
8. Capability ve test cockpit kayıtlarını doğrular.
9. Extension completeness validator'ı çalıştırır.
10. Değiştirilen zorunlu dosyaları sonuç raporunda açıkça listeler.

### 14.8. Extension completeness gate

Bir extension aşağıdaki şartlar sağlanmadan tamamlanmış sayılamaz:

```text
[ ] En yakın EXTENSIONS.md okundu
[ ] Implementation mevcut
[ ] Ana registry kaydı mevcut
[ ] Config ve config schema güncel
[ ] Environment variable örnekleri güncel
[ ] Service container veya provider kaydı mevcut
[ ] Route, menu, permission, event veya hook kayıtları güncel
[ ] Migration, fixture ve seed gereksinimleri uygulandı
[ ] Kullanıcı kılavuzu güncel
[ ] Developer guide güncel
[ ] Capability contract güncel
[ ] Test cockpit kaydı mevcut
[ ] Unit ve contract testleri geçiyor
[ ] Hata senaryoları mevcut
[ ] Changelog güncel
[ ] Removal ve cleanup adımları tanımlı
```

### 14.9. Extension removal contract

Extension ekleme kadar kaldırma işlemi de tanımlanmalıdır.

Bir extension kaldırılırken:

- Registry kaydı silinmeli
- Config schema temizlenmeli
- Kullanılmayan environment variable'lar kaldırılmalı
- Route, permission, menu, event ve hook kayıtları temizlenmeli
- Migration veya veri saklama kararı alınmalı
- Test cockpit senaryoları kaldırılmalı veya arşivlenmeli
- Kullanıcı ve developer dokümantasyonu güncellenmeli
- Capability contract etkileri değerlendirilmelidir
- Breaking change ve migration notları yazılmalıdır
- Orphan config ve registry kayıtları taranmalıdır

### 14.10. Neden yalnızca checklist yeterli değildir?

Checklist tek başına zamanla eskiyebilir.

Framework mümkün olduğunda:

- Checklist içindeki dosya yollarını doğrulamalı
- Implementation ile registry kayıtlarını karşılaştırmalı
- Config schema ile örnek config'i karşılaştırmalı
- Dokümantasyon kaydının varlığını kontrol etmeli
- Capability map ve test cockpit kayıtlarını doğrulamalı
- Kaldırılmış extension'lara ait orphan kayıtları bulmalı
- Zorunlu dosyalarda yapılan değişiklikleri pull request veya agent raporunda göstermelidir

Böylece `EXTENSIONS.md`, pasif bir doküman değil, otomasyon tarafından doğrulanan yaşayan bir sözleşme haline gelir.

---

## 14. Kalite Kapıları

### 14.1. Feature gate

Yeni özellik tamamlanmadan önce:

```text
[ ] Ürün gereksinimi açık
[ ] Capability mevcut veya oluşturuldu
[ ] Input-output sözleşmesi tanımlı
[ ] Normal senaryo var
[ ] Hata senaryosu var
[ ] Edge case'ler değerlendirildi
[ ] Otomatik testler geçiyor
[ ] Kullanıcı test ekranı çalışıyor
[ ] Capability bütçeleri korunuyor
[ ] Mimari invariant'lar korunuyor
[ ] Güvenlik kontrolü tamamlandı
[ ] Performance bütçesi aşılmadı
[ ] İlgili kararlar güncellendi
[ ] İlgili kaynaklar bağlandı
[ ] Regresyon yok
```

### 14.2. Agent'ın tamamlanma raporu

Agent yalnızca şu biçimde rapor vermemelidir:

```text
Implementation completed.
```

Bunun yerine:

```text
Implementation completed.

Capability checks:
- 12 capability contracts evaluated
- 11 passed
- 1 requires user validation
- 0 architecture budget violations
- 0 unresolved regressions
- 2 ADR documents updated
- 1 source record added
```

### 14.3. CI/CD kapıları

CI süreci şunları kontrol edebilir:

- İlgili extension point için `EXTENSIONS.md` bulunup bulunmadığı
- Yeni eklentinin zorunlu registry, config, guide, capability ve test cockpit kayıtlarının tamamlanıp tamamlanmadığı
- Kaldırılan eklentilere ait orphan kayıtların kalıp kalmadığı
- Eksik capability contract
- Contract ile implementation uyumsuzluğu
- Bütçe ihlali
- Cyclic dependency
- Yetkisiz dependency
- Güncellenmemiş ADR
- Eksik test senaryosu
- Kullanıcı demo ekranına bağlanmamış capability
- Süresi geçmiş review
- Deprecated teknoloji kullanımı
- Lisans bilgisi eksik kaynak
- Kırılmış referanslar

---

## 15. Teknoloji Upgrade ve Refactor Mantığı

### 15.1. Yaşayan teknoloji radarı

`tech/technology-radar.md` veya makine tarafından okunabilir bir YAML dosyası şu kategorileri içerebilir:

```text
adopt
trial
assess
hold
deprecate
replace
```

### 15.2. Upgrade trigger'ları

- Yeni major sürüm
- Güvenlik açığı
- Resmi desteğin bitmesi
- Bakım faaliyetinin durması
- Lisans değişikliği
- Performans sınırının aşılması
- Alternatif çözümün belirgin avantaj sağlaması
- Operasyonel maliyet artışı
- Kullanılan yaklaşımın mimari varsayımlarının değişmesi

### 15.3. Refactor proposal

Bir capability veya modül sınırı aşıldığında:

```markdown
# Refactor Proposal

## Sorun

Capability sorumluluk ve bağımlılık bütçesini aşıyor.

## Kanıt

- 9 direct dependency
- 4 farklı değişiklik nedeni
- Son 10 değişikliğin 6'sında regresyon
- 3 farklı domain'e erişim

## Önerilen Bölünme

- pricing-calculation
- delivery-estimation
- destination-zone-resolution

## Riskler

- API değişikliği
- Migration ihtiyacı
- Geçici duplication

## Test Planı

- Mevcut contract testleri korunacak
- Her yeni capability için ayrı contract oluşturulacak
- Eski endpoint compatibility testi eklenecek
```

---

## 16. Agent Adaptörleri

Framework'ün çekirdeği agent-independent olmalıdır. Agent-specific dosyalar yalnızca adaptör olmalıdır.

Örnek:

```text
adapters/
├── generic/
│   └── AGENTS.md
├── claude/
│   └── CLAUDE.md
├── cursor/
│   └── .cursor/rules/framework.mdc
├── copilot/
│   └── .github/copilot-instructions.md
└── codex/
    └── AGENTS.md
```

Bu adaptörler aynı kuralları farklı agent formatlarına dönüştürür.

Ana kaynak her zaman framework klasörleri ve machine-readable contract'lar olmalıdır. Agent-specific instruction dosyaları ikinci bir truth source haline gelmemelidir.

---

## 17. Piyasadaki Yakın Yaklaşımlar

Aşağıdaki sistemler fikrin belirli parçalarına yaklaşmaktadır. Ancak incelenen yaklaşımlardan hiçbiri karar yaşam döngüsü, kanıt yönetimi, capability bütçeleri, kullanıcı tarafından çalıştırılabilen test yüzeyi ve agent governance katmanlarını tek bir genel standart olarak birleştirmemektedir.

### 17.1. GitHub Spec Kit

Yakın olduğu alanlar:

- Spec-driven development
- Constitution
- Specification
- Planning
- Task üretimi
- Agent entegrasyonları

Eksik kalan alanlar:

- Kararların kanıt ve kaynak yaşam döngüsü
- Capability başına zorunlu kullanıcı test ekranı
- Semantik büyüklük bütçeleri
- Teknoloji kararlarının eskime trigger'ları
- Capability health cockpit

Resmi repository:

```text
https://github.com/github/spec-kit
```

### 17.2. OpenSpec

Yakın olduğu alanlar:

- Chat history yerine repository tabanlı spec katmanı
- Proposal → specs → design → tasks → implement akışı
- Agent-independent yaklaşım
- İncelenebilir değişiklikler

Eksik kalan alanlar:

- Capability bütçeleri
- Kanıt ve akademik kaynak grafiği
- Standart executable capability UI
- Kararların review trigger'ları
- Kullanıcı doğrulama yüzeyi

Resmi kaynaklar:

```text
https://github.com/Fission-AI/OpenSpec
https://openspec.dev/
```

### 17.3. BMAD Method

Yakın olduğu alanlar:

- Uzman agent rolleri
- Analiz, planlama, solutioning ve implementation workflow'ları
- Context engineering
- Test architect yaklaşımı
- Proje ölçeğine göre süreç uyarlama

Eksik kalan alanlar:

- Her capability için standart contract
- Kullanıcıya açık capability test cockpit'i
- Zorunlu semantic size budget
- Kaynak provenance standardı
- Agent-independent repository governance çekirdeği

Resmi kaynaklar:

```text
https://github.com/bmad-code-org/BMAD-METHOD
https://docs.bmad-method.org/
```

### 17.4. AGENTS.md

Yakın olduğu alanlar:

- Coding agent'lar için açık repository instruction formatı
- Root ve alt dizinlerde yerel talimatlar
- Tool-independent yaklaşım

Eksik kalan alanlar:

- Tek başına framework değildir
- Karar yaşam döngüsü sağlamaz
- Capability contract sağlamaz
- Test cockpit oluşturmaz
- Kaynak ve kanıt yönetmez

Resmi kaynak:

```text
https://agents.md/
```

### 17.5. Kiro Specs

Yakın olduğu alanlar:

- Requirements, design ve tasks ayrımı
- Acceptance criteria
- Structured specifications
- Property-based test üretimi
- Bugfix sırasında korunacak davranışların tanımlanması
- Regresyon kontrolü

Eksik kalan alanlar:

- Agent-independent açık repository standardı
- Her capability için zorunlu test ekranı
- Semantik modül bütçeleri
- Kaynak ve karar provenance katmanı
- Uygulama genelinde capability cockpit

Resmi kaynaklar:

```text
https://kiro.dev/docs/specs/
https://kiro.dev/docs/specs/correctness/
```

### 17.6. Cucumber ve Gherkin

Yakın olduğu alanlar:

- İnsan tarafından okunabilir executable specification
- Given / When / Then senaryoları
- Otomatik test
- Yaşayan dokümantasyon
- Domain dili

Eksik kalan alanlar:

- Mimari modülerlik
- Kod büyüklüğü kontrolü
- Dependency budget
- Agent governance
- Genel capability test cockpit'i
- Teknoloji ve kaynak yaşam döngüsü

Resmi kaynak:

```text
https://cucumber.io/docs/
```

### 17.7. Storybook

Yakın olduğu alanlar:

- UI bileşenlerini izole çalıştırma
- Farklı durumları kullanıcıya gösterme
- Interaction testleri
- Visual testing
- Testleri görünür hale getirme

Eksik kalan alanlar:

- Backend ve domain capability'leri
- Background job'lar
- Genel API davranışları
- Mimari karar yönetimi
- Kod büyüklüğü ve bağımlılık bütçeleri

Resmi kaynak:

```text
https://storybook.js.org/docs/writing-tests
```

### 17.8. Playwright UI Mode

Yakın olduğu alanlar:

- Testleri tek tek çalıştırma
- Adım bazlı inceleme
- Görsel debugging
- Watch mode
- Passed, failed ve skipped durumları

Eksik kalan alanlar:

- Ürün capability'lerini standartlaştırmaz
- Testleri ürün yeteneği sözleşmesine dönüştürmez
- Mimari governance sağlamaz
- Kaynak ve karar yönetmez

Resmi kaynak:

```text
https://playwright.dev/docs/test-ui-mode
```

### 17.9. ADR ve MADR

Yakın olduğu alanlar:

- Teknik kararların gerekçelendirilmesi
- Alternatiflerin kaydı
- Sonuçların ve trade-off'ların belgelenmesi

Eksik kalan alanlar:

- Otomatik review trigger'ları
- Kaynak grafiği
- Capability contract bağlantısı
- Test cockpit
- Kod ile karar arasındaki drift kontrolü

---

## 18. Özgün Değer Önerisi

Framework'ün özgünlüğü tek tek klasörler veya Markdown dosyaları değildir. Esas değer, aşağıdaki parçaların tek sistemde birleşmesidir:

1. **Repository-native project memory**
2. **Architecture decision lifecycle**
3. **Evidence and source provenance**
4. **Executable capability contracts**
5. **User-visible test cockpit**
6. **Semantic responsibility boundaries**
7. **Capability size and dependency budgets**
8. **Automated architecture drift detection**
9. **Technology upgrade and refactor triggers**
10. **Agent authority and human approval boundaries**
11. **Agent-independent adapters**
12. **Definition of done enforced by machine-readable gates**
13. **Directory-local extension registration contracts**
14. **Automated extension completeness validation**

Kısa değer önerisi:

> Spec framework'leri agent'a ne inşa edeceğini söyler. Bu framework ayrıca sistemin neden bu şekilde kurulduğunu, hangi kanıtların kararları desteklediğini, her yeteneğin gerçekten çalışıp çalışmadığını ve bu kararların ne zaman yeniden değerlendirilmesi gerektiğini korur.

İngilizce konumlandırma:

> An agent-independent, evidence-governed repository architecture for long-lived AI-assisted software projects.

Daha capability odaklı alternatif:

> A capability-first governance and verification framework that keeps AI-generated software understandable, testable and maintainable.

---

## 19. Framework Ne Değildir?

Bu sistem:

- Yeni bir LLM modeli değildir.
- Tek bir IDE eklentisi olmak zorunda değildir.
- Yalnızca prompt koleksiyonu değildir.
- Yalnızca test framework'ü değildir.
- Yalnızca ADR şablonu değildir.
- Yalnızca spec-driven development aracı değildir.
- Yalnızca frontend component explorer değildir.
- Mevcut agent'ların yerine geçmek zorunda değildir.

Bu sistem, farklı agent ve teknoloji yığınlarının üzerinde çalışan bir governance ve verification katmanı olmalıdır.

---

## 20. Olası İlk Sürüm

İlk açık kaynak sürüm aşağıdaki parçalardan oluşabilir:

### 20.1. Bootstrap manifesto

```text
AGENTIC-FRAMEWORK.md
```

### 20.2. Standart dizin şeması

- Governance
- Decisions
- Sources
- Capabilities
- Quality
- Lifecycle
- Templates

### 20.3. Machine-readable şemalar

- `adr.schema.json`
- `source.schema.json`
- `capability.schema.json`
- `quality-gates.schema.json`
- `technology-radar.schema.json`
- `extension-contract.schema.json`

### 20.4. CLI

Örnek komutlar:

```bash
framework init
framework discover
framework capability add
framework capability run
framework capability validate
framework audit
framework review
framework upgrade-check
framework refactor-check
framework generate-adapters
framework extension discover
framework extension add
framework extension validate
framework extension remove
framework cockpit
```

### 20.5. Test cockpit

- Capability listesi
- Input formu
- Expected/actual comparison
- Test sonuçları
- Dependency graph
- ADR ve evidence bağlantıları
- User approval

### 20.6. CI entegrasyonu

- GitHub Action
- GitLab CI template
- Generic CLI exit codes

### 20.7. Agent adaptörleri

- AGENTS.md
- CLAUDE.md
- Cursor rules
- Copilot instructions
- Kiro steering/spec integration
- Generic prompt adapter

---

## 21. Örnek CLI Akışı

```bash
framework init
```

Şunları yapar:

1. Repository'yi analiz eder.
2. Dil ve framework'leri tespit eder.
3. Governance yapısını oluşturur.
4. Mevcut mimari kararları taslak olarak çıkarır.
5. Capability adaylarını listeler.
6. İnsan onayı gerektiren belirsizlikleri raporlar.

```bash
framework discover
```

Şunları üretir:

```text
Discovered capabilities:
- user-registration
- user-login
- password-reset
- calculate-shipping-cost
- create-order

Potential architecture violations:
- Shipping service accesses payment tables
- User service sends email directly
- Order module has 11 direct dependencies
```

```bash
framework audit
```

Örnek çıktı:

```text
Framework Audit

Capabilities: 24
Healthy: 18
Needs review: 4
Budget violations: 2
Expired ADR reviews: 3
Missing evidence links: 5
Capabilities without user demo: 2
Detected architecture drift: 1
```

---

## 22. Açık Tasarım Soruları

Framework geliştirilirken aşağıdaki konular ayrıca tasarlanmalıdır:

1. Capability sınırları nasıl otomatik keşfedilecek?
2. Semantik kohezyon LLM ile mi, statik analizle mi, hibrit biçimde mi ölçülecek?
3. Capability contract'ın kaynak kodla uyumu nasıl doğrulanacak?
4. Kullanıcı test ekranı her teknoloji yığınına nasıl bağlanacak?
5. Stateful ve destructive işlemler güvenli biçimde nasıl test edilecek?
6. Production verisi kullanılmadan gerçekçi test input'ları nasıl üretilecek?
7. LLM tabanlı capability'lerde beklenen output deterministik değilse doğrulama nasıl yapılacak?
8. Human approval kayıtları nasıl imzalanacak?
9. Repository içindeki PDF ve büyük dosyalar nasıl yönetilecek?
10. Framework kuralları agent tarafından değiştirilmek istendiğinde hangi governance süreci çalışacak?
11. Capability bütçeleri proje boyutuna göre nasıl kalibre edilecek?
12. Bir capability ne zaman bölünmeli, ne zaman birleşmeli?
13. Teknik test ile ürün kabul testi arasındaki sınır nasıl tanımlanacak?
14. Framework'ün kendisinin aşırı dokümantasyon üretmesi nasıl engellenecek?
15. Agent'ın gereksiz ADR veya capability üretmesi nasıl önlenecek?
16. Legacy projelerde incremental adoption nasıl yapılacak?
17. Monorepo ve microservice yapılarda capability haritası nasıl oluşturulacak?
18. Kaynakların güncelliği ve güvenilirliği nasıl puanlanacak?
19. Extension sözleşmeleri mevcut kod ve registry convention'larından otomatik üretilebilir mi?
20. Root ve alt dizinlerdeki `EXTENSIONS.md` kuralları nasıl miras alınacak?
21. Zorunlu dosya güncellemesinin gerçekten yapıldığı içerik düzeyinde nasıl doğrulanacak?
22. Extension removal sırasında orphan config, permission, route ve registry kayıtları nasıl tespit edilecek?

---

## 23. Tasarım Prensipleri

Framework geliştirilirken şu prensipler korunmalıdır:

### 23.1. İnsan tarafından okunabilir, makine tarafından doğrulanabilir

Markdown açıklamalar için, YAML veya JSON şemaları otomasyon için kullanılabilir.

### 23.2. Progressive adoption

Kullanıcı framework'ün tamamını ilk günden uygulamak zorunda kalmamalıdır.

Örnek aşamalar:

```text
Level 1: Governance ve ADR
Level 2: Capability contracts
Level 3: Automated tests
Level 4: User test cockpit
Level 5: Architecture budgets
Level 6: Lifecycle ve upgrade automation
```

### 23.3. Tek gerçeklik kaynağı

Aynı bilginin birden fazla agent dosyasında kopyalanması önlenmelidir.

### 23.4. Minimum useful documentation

Her dosya gerçek bir karar, sözleşme veya kontrol için var olmalıdır. Dekoratif dokümantasyon üretilmemelidir.

### 23.5. Fail visibly

Bir capability bozulduğunda sonuç görünür olmalıdır. Sessiz başarısızlık kabul edilmemelidir.

### 23.6. Human inspectability

Kullanıcı agent'ın ne yaptığını yalnızca diff üzerinden anlamak zorunda kalmamalıdır.

### 23.7. Refactor before collapse

Bütçe ihlali, uygulama bozulduktan sonra değil önce refactor tetiklemelidir.

### 23.8. Evidence over confidence

Agent'ın yüksek güvenle verdiği açıklama, kaynak veya test yerine geçmemelidir.

### 23.9. Registration over convention

Bir extension'ın çalışması için gereken kayıt noktaları ekip hafızasına, isimlendirme convention'ına veya agent tahminine bırakılamaz.

Güncellenmesi zorunlu dosyalar açıkça belgelenmeli ve mümkün olduğunda otomatik doğrulanmalıdır.

### 23.10. Local rules near the extension point

Bir extension sistemine ait kurallar mümkün olduğunca ilgili dizine yakın tutulmalıdır.

Bu sayede geliştirici veya agent yeni bir modül eklerken genel dokümantasyon içinde kaybolmadan doğru talimata ulaşır.


---

## 24. Geçici İsim Önerileri

Bu belge nihai isim belirlemez. Olası isim yönleri:

### Governance odaklı

- Agentic Governance Framework
- Code Constitution
- Repository Constitution
- Software Steward
- Architecture Steward

### Capability odaklı

- Capability Contract
- Capability OS
- Capability First
- Capability Ledger
- Capability Cockpit

### Maintainability odaklı

- VibeGuard
- CodeGuardrail
- Maintainable AI
- Agentic Guardrails
- Code Stability Framework

### Kanıt odaklı

- EvidenceCode
- Provenance Driven Development
- Evidence-Governed Development
- DecisionGraph
- SourceBound

İsim daha sonra framework'ün en ayırt edici yönüne göre seçilmelidir.

---

## 25. Sonuç

Piyasada bu fikrin parçalarını çözen güçlü yaklaşımlar bulunmaktadır:

- Spec Kit ve OpenSpec, spec-driven geliştirmeyi
- BMAD, agent workflow ve planlamayı
- AGENTS.md, repository talimatlarını
- Kiro, structured specs ve property-based testing'i
- Cucumber, executable specifications'ı
- Storybook, izole ve görünür UI testlerini
- Playwright, interaktif test yürütme ve debugging'i
- ADR yaklaşımları, mimari karar kaydını
- Çeşitli plugin ve module sistemleri ise extension registry yaklaşımını

çözmektedir.

Ancak burada önerilen yaklaşım bunları daha geniş bir problem çerçevesinde birleştirir:

> AI tarafından üretilen yazılımın yalnızca bugün çalışmasını değil, uzun vadede anlaşılır, sınırlandırılmış, kanıta dayalı, test edilebilir, kullanıcı tarafından doğrulanabilir ve yeniden değerlendirilebilir kalmasını sağlamak.

Bu nedenle fikir, başka bir coding agent olmaktan çok daha güçlü biçimde şu şekilde konumlandırılabilir:

> Uzun ömürlü agentic yazılım projeleri için capability-first, evidence-governed ve repository-native bir geliştirme standardı.

Bu standardın yeni bir çekirdek parçası da extension, plugin ve modül geliştirmelerinde zorunlu entegrasyon noktalarını dizin bazlı Markdown sözleşmeleri ve otomatik completeness gate'leriyle güvence altına almaktır.

Bu belge, framework'ün ilk konsept kaydıdır. Yeni fikirler eklendikçe ayrı karar kayıtlarına, capability şemalarına, prototiplere ve uygulama planlarına dönüştürülebilir.

---

## 26. Referans Niteliğindeki Resmi Kaynaklar

- GitHub Spec Kit: https://github.com/github/spec-kit
- OpenSpec: https://github.com/Fission-AI/OpenSpec
- OpenSpec Documentation: https://openspec.dev/
- BMAD Method: https://github.com/bmad-code-org/BMAD-METHOD
- BMAD Documentation: https://docs.bmad-method.org/
- AGENTS.md: https://agents.md/
- Kiro Specs: https://kiro.dev/docs/specs/
- Kiro Spec Correctness: https://kiro.dev/docs/specs/correctness/
- Cucumber Documentation: https://cucumber.io/docs/
- Storybook Testing: https://storybook.js.org/docs/writing-tests
- Playwright UI Mode: https://playwright.dev/docs/test-ui-mode
