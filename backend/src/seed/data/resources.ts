/**
 * Starter educational content. Summaries are written in plain language
 * (about 5th-grade level) with harder words explained in brackets.
 *
 * Each item points to the authoritative source it summarises. Before launch,
 * a clinician and a content editor must: confirm every link still works,
 * confirm the summary matches the source, set `reviewedBy`, and update
 * `lastReviewedAt`. See docs/CLINICAL_REVIEW.md.
 */
export const RESOURCES = [
  {
    slug: 'colorectal-cancer-symptoms',
    title: 'Signs to watch for in your bowel',
    topics: ['symptoms'],
    summary: 'Some body changes are worth telling a doctor about. Most have causes that are not cancer.',
    body:
      'Colorectal cancer is cancer in the colon or rectum (the large bowel and its end). Early on, it often causes no signs at all. That is why screening matters.\n\n' +
      'Tell a doctor if you notice: blood in your poop or from your bottom, a change in how often you poop that lasts more than a few weeks, belly pain that does not go away, losing weight without trying, or feeling very tired.\n\n' +
      'These signs can have many causes, like hemorrhoids (swollen veins near the bottom). Only a doctor can find the cause.',
    source: { name: 'U.S. Centers for Disease Control and Prevention (CDC)', url: 'https://www.cdc.gov/colorectal-cancer/symptoms/index.html' },
  },
  {
    slug: 'screening-basics',
    title: 'What is screening?',
    topics: ['screening'],
    summary: 'Screening means checking for cancer before you have signs. It can find polyps before they turn into cancer.',
    body:
      'Screening tests look for cancer or polyps (small growths inside the bowel) in people who feel fine.\n\n' +
      'Some tests check a poop sample at home. Others, like a colonoscopy (a test where a doctor looks inside your bowel with a thin camera), are done at a clinic.\n\n' +
      'U.S. experts suggest most adults start at age 45. You may need to start sooner, or test more often, if cancer or polyps run in your family, or if you have certain bowel diseases. Ask your doctor what is right for you.',
    source: {
      name: 'U.S. Preventive Services Task Force',
      url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening',
      publishedOrReviewed: 'Final recommendation, May 2021',
    },
  },
  {
    slug: 'screening-tests-cdc',
    title: 'Kinds of screening tests',
    topics: ['screening', 'diagnostic_tests'],
    summary: 'There is more than one way to get screened. The best test is the one you will actually do.',
    body:
      'Stool tests (poop tests) like FIT can be done at home. If the result is not normal, you will need a colonoscopy.\n\n' +
      'A colonoscopy lets the doctor see the whole colon and remove polyps during the same test.\n\n' +
      'Talk with your doctor about the pros and cons of each test.',
    source: { name: 'U.S. Centers for Disease Control and Prevention (CDC)', url: 'https://www.cdc.gov/colorectal-cancer/screening/index.html' },
  },
  {
    slug: 'family-history-and-genes',
    title: 'Family history and inherited risk',
    topics: ['family_history', 'screening'],
    summary: 'Some cancer risk is passed down in families. A genetic counselor can help you understand yours.',
    body:
      'Some people are born with a gene change (a tiny difference in the body’s instructions) that raises cancer risk. Lynch syndrome is one example.\n\n' +
      'If close family members had colorectal cancer, especially before age 50, tell your doctor. You might need earlier screening or genetic testing.\n\n' +
      'A genetic counselor is an expert who explains these tests and what the results mean.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/about-cancer/causes-prevention/genetics/genetic-testing-fact-sheet' },
  },
  {
    slug: 'colonoscopy-prep',
    title: 'Getting ready for a colonoscopy',
    topics: ['diagnostic_tests'],
    summary: 'A clean bowel helps the doctor see clearly. Follow your clinic’s instructions closely.',
    body:
      'Before a colonoscopy, you drink a special liquid called a “prep” that empties your bowel. You will also eat only clear liquids for a day or so.\n\n' +
      'You get medicine to help you relax or sleep during the test. Plan for someone to drive you home.\n\n' +
      'Always follow the exact instructions from your own clinic.',
    source: { name: 'National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK)', url: 'https://www.niddk.nih.gov/health-information/diagnostic-tests/colonoscopy' },
  },
  {
    slug: 'pathology-reports',
    title: 'Understanding a biopsy and pathology report',
    topics: ['pathology', 'diagnostic_tests'],
    summary: 'A biopsy takes a tiny piece of tissue to look at under a microscope. The report explains what was found.',
    body:
      'A biopsy (BY-op-see) is when a doctor takes a small piece of tissue. A pathologist (a doctor who studies tissue) looks at it under a microscope.\n\n' +
      'The pathology report says whether cancer cells were found and, if so, what kind. Reports use hard words, so ask your doctor to go through it with you.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/pathology-reports-fact-sheet' },
  },
  {
    slug: 'treatment-types',
    title: 'Types of cancer treatment',
    topics: ['treatment'],
    summary: 'Treatment depends on the type and stage of cancer. Your team will explain your options.',
    body:
      'Common treatments include surgery (an operation to remove cancer), chemotherapy (strong medicine that kills cancer cells), radiation (energy beams aimed at cancer), immunotherapy (medicine that helps your body fight cancer), and targeted therapy (medicine aimed at cancer cells).\n\n' +
      'Good questions to ask: What are my choices? What are the goals of treatment? What side effects might I have? Who do I call after hours?\n\n' +
      'Getting a second opinion (asking another expert) is common and okay.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/about-cancer/treatment/types' },
  },
  {
    slug: 'colorectal-cancer-overview',
    title: 'About colorectal cancer',
    topics: ['treatment', 'symptoms', 'screening'],
    summary: 'A trusted overview of colorectal cancer, from causes to treatment.',
    body:
      'Colorectal cancer starts in the colon or rectum. It often begins as a polyp that slowly changes over years.\n\n' +
      'Finding it early makes it easier to treat. Screening, knowing your family history, and talking with your doctor about symptoms all help.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/types/colorectal' },
  },
  {
    slug: 'side-effects',
    title: 'Handling treatment side effects',
    topics: ['side_effects'],
    summary: 'Side effects are changes in your body caused by treatment. Your team can help with most of them.',
    body:
      'Side effects can include feeling tired, upset stomach, diarrhea (loose poop), mouth sores, or tingling hands and feet.\n\n' +
      'Always tell your care team about side effects. Many can be treated. Call right away if you have a fever during treatment.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/about-cancer/treatment/side-effects' },
  },
  {
    slug: 'pain-and-comfort',
    title: 'Pain and comfort',
    topics: ['pain_comfort', 'side_effects'],
    summary: 'Pain can almost always be helped. Tell your care team how you feel.',
    body:
      'Use the 1–10 scale to tell your team how strong your pain is. Say where it is and what makes it better or worse.\n\n' +
      'Calm breathing, relaxing, and comfy positions can help some people. Ask your team before using heat, cold, or massage, especially after surgery or radiation.\n\n' +
      'Do not change pain medicine without talking to your doctor or pharmacist.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/about-cancer/treatment/side-effects/pain' },
  },
  {
    slug: 'eating-hints',
    title: 'Eating well during treatment',
    topics: ['nutrition'],
    summary: 'Food gives you energy to heal. Small meals and lots of fluids can help.',
    body:
      'Treatment can change your appetite (how hungry you feel) and taste. Try small meals often and drink plenty of fluids.\n\n' +
      'No single food or diet cures cancer. An oncology dietitian (a food expert for people with cancer) can make a plan just for you.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/publications/patient-education/eating-hints' },
  },
  {
    slug: 'feelings-and-cancer',
    title: 'Feelings and cancer',
    topics: ['emotional_wellbeing'],
    summary: 'It is normal to feel scared, sad or angry. Talking about it helps.',
    body:
      'Cancer can bring big feelings, for patients and families. You do not have to handle them alone.\n\n' +
      'Counselors, support groups, and faith leaders can help. If you ever think about hurting yourself, call or text 988 (the Suicide and Crisis Lifeline in the U.S.).',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/about-cancer/coping/feelings' },
  },
  {
    slug: 'caregivers',
    title: 'Support for family and friends',
    topics: ['caregiver', 'emotional_wellbeing'],
    summary: 'Caregivers need care too. Ask for help and take breaks.',
    body:
      'A caregiver is someone who helps a person with cancer. It can be a lot of work.\n\n' +
      'Make a list of tasks others can help with. Take time for yourself. Support groups for caregivers can help you feel less alone.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/about-cancer/coping/family-friends' },
  },
  {
    slug: 'survivorship',
    title: 'Life after treatment',
    topics: ['survivorship'],
    summary: 'After treatment, regular check-ups help you stay healthy.',
    body:
      'A survivor is anyone who has had cancer. After treatment, you will have follow-up visits (check-ups) to watch your health.\n\n' +
      'Ask your team for a survivorship care plan. It lists your treatments and which check-ups you need.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/about-cancer/coping/survivorship' },
  },
  {
    slug: 'other-cancer-types',
    title: 'Other types of cancer',
    topics: ['other_cancers'],
    summary: 'Learn about other kinds of cancer from a trusted source.',
    body: 'There are many kinds of cancer. The National Cancer Institute has easy guides for each type, plus help finding specialists.',
    source: { name: 'National Cancer Institute (NCI)', url: 'https://www.cancer.gov/types' },
  },
  {
    slug: 'acs-colorectal',
    title: 'Colorectal cancer guide',
    topics: ['symptoms', 'screening', 'treatment', 'survivorship'],
    summary: 'A full guide from a leading cancer organization.',
    body: 'The American Cancer Society has guides on risk, screening, treatment and life after colorectal cancer. They also run a 24/7 helpline.',
    source: { name: 'American Cancer Society', url: 'https://www.cancer.org/cancer/types/colon-rectal-cancer.html' },
  },
] as const;
