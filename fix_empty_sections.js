const https = require('https');

// Configuration
const APP_URL = 'bylaws-amendment-tracker.onrender.com';
const DOC_ID = '1LdE2NGMOJ7BgV19V3Qb-hnN5VTmB5C_Hh6heemqxviA';

// Section fixes based on DETECTIVE's findings
const sectionFixes = [
  {
    citation: 'Article V, Section 2',
    content: 'The quorum shall be eight (8) members of the Board. No floating quorums are allowed.'
  },
  {
    citation: 'Article V, Section 3',
    content: 'A simple majority vote by the Board members present and voting, not including abstentions, at a meeting at which there is a quorum shall be required to take official action, unless specified otherwise in these Bylaws.'
  },
  {
    citation: 'Article V, Section 10',
    content: 'A Board member may resign from the RNC by stating one\'s intention in written communication, and the position shall then be deemed vacant.'
  },
  {
    citation: 'Article VI, Section 1',
    content: 'The Officers of the Board ("Officers") shall consist of a President, a Vice-President, a Treasurer, a Secretary, a Sergeant at Arms, and a Parliamentarian. These Officers shall be elected by the Board as provided below, and all must be members of the Board.'
  },
  {
    citation: 'Article VI, Section 4',
    content: 'The Officers shall serve two (2) year terms and serve at the pleasure of the Board. No President or Vice-President shall serve more than two (2) consecutive two (2) year terms in that office.'
  },
  {
    citation: 'Article VII, Section 2',
    content: 'The Board may create Ad Hoc Committees as deemed necessary. Six (6) months after creation the Board shall review said committees and decide if the ad hoc committee(s) activities warrant disbanding the committee, renewing its ad hoc status, elevating it to a permanent RNC committee, or merging it with an existing committee. Ad hoc committees shall be agendized and noticed in keeping with the Brown Act.'
  },
  {
    citation: 'Article X, Section 1',
    content: 'The Neighborhood Council\'s election will be conducted pursuant to any and all City ordinances, policies and procedures pertaining to Neighborhood Council elections.'
  },
  {
    citation: 'Article X, Section 2',
    content: 'The number of Board seats, the eligibility requirements for holding any specific Board seats, and which Stakeholders may vote for the Board seats are noted in Attachment B.'
  },
  {
    citation: 'Article X, Section 3',
    content: 'Except with respect to a Youth Board Seat, a stakeholder must be at least 16 years of age on the day of the election or selection to be eligible to vote. [See Admin. Code §§ 22.814(a) and 22.814(c)]'
  },
  {
    citation: 'Article X, Section 4',
    content: 'Voters will verify their Stakeholder status by self-affirmation.'
  },
  {
    citation: 'Article X, Section 5',
    content: 'A candidate shall declare their candidacy for no more than one position on the Board during a single election cycle.'
  },
  {
    citation: 'Article XIV, Section 1',
    content: 'The RNC board members, its representatives, and all Stakeholders shall conduct all RNC business in a civil, professional and respectful manner. Board members will abide by the Commission\'s Neighborhood Council Board member Code of Conduct Policy.'
  },
  {
    citation: 'Article XIV, Section 3',
    content: 'Every year, the Council shall conduct a self-assessment pursuant to Article VI, Section 1 of the Plan.'
  }
];

async function getSections() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: APP_URL,
      port: 443,
      path: `/bylaws/api/sections/${DOC_ID}`,
      method: 'GET'
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.sections);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function updateSection(sectionId, content) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ original_text: content });

    const options = {
      hostname: APP_URL,
      port: 443,
      path: `/bylaws/api/sections/${sectionId}/update-text`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function deleteDuplicateSection() {
  return new Promise((resolve, reject) => {
    // We'll need to get the section ID first, then delete it
    getSections().then(sections => {
      const duplicateSection = sections.find(s => s.section_citation === 'Section 3' && !s.section_citation.includes('Article'));
      if (duplicateSection) {
        const options = {
          hostname: APP_URL,
          port: 443,
          path: `/bylaws/api/sections/${duplicateSection.id}`,
          method: 'DELETE'
        };

        https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve({ deleted: true, id: duplicateSection.id }));
        }).on('error', reject).end();
      } else {
        resolve({ deleted: false, message: 'Duplicate not found' });
      }
    });
  });
}

async function main() {
  console.log('🔧 Fixing Empty Sections in Bylaws Database\n');

  try {
    // Step 1: Get all sections
    console.log('📥 Fetching sections from database...');
    const sections = await getSections();
    console.log(`✅ Found ${sections.length} sections\n`);

    // Step 2: Fix empty sections
    console.log('🔨 Fixing empty sections...\n');
    let fixedCount = 0;

    for (const fix of sectionFixes) {
      const section = sections.find(s => s.section_citation === fix.citation);
      if (section) {
        console.log(`   Fixing: ${fix.citation}`);
        console.log(`   Current: "${section.original_text || '(empty)'}"`);
        console.log(`   New: "${fix.content.substring(0, 60)}..."`);

        const result = await updateSection(section.id, fix.content);
        if (result.success || result.status === 200) {
          console.log(`   ✅ Updated successfully\n`);
          fixedCount++;
        } else {
          console.log(`   ❌ Failed: ${JSON.stringify(result)}\n`);
        }
      } else {
        console.log(`   ⚠️  Section not found: ${fix.citation}\n`);
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} of ${sectionFixes.length} empty sections\n`);

    // Step 3: Delete duplicate
    console.log('🗑️  Deleting duplicate "Section 3"...');
    const deleteResult = await deleteDuplicateSection();
    if (deleteResult.deleted) {
      console.log(`✅ Deleted duplicate section (ID: ${deleteResult.id})\n`);
    } else {
      console.log(`⚠️  ${deleteResult.message}\n`);
    }

    console.log('🎉 Database fixes complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Fixed: ${fixedCount} empty sections`);
    console.log(`   - Deleted: ${deleteResult.deleted ? 1 : 0} duplicate section`);
    console.log(`   - Total sections should now be: ${sections.length - (deleteResult.deleted ? 1 : 0)}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
