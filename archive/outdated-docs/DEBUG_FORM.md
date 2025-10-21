# Debug the Form Issue

Open browser console (F12) and paste this:

```javascript
// Check if fields exist
console.log('Organization Name field:', document.getElementById('orgName'));
console.log('Organization Type field:', document.getElementById('orgType'));

// Check their values
console.log('Name value:', document.getElementById('orgName')?.value);
console.log('Type value:', document.getElementById('orgType')?.value);

// Check form data
const form = document.getElementById('organizationForm');
const formData = new FormData(form);
for (let [key, value] of formData.entries()) {
    console.log(key + ': ' + value);
}
```

This will show us what's actually being captured.
