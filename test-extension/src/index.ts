import { ui, dialog } from '@elfsquad/custom-scripting';


const reloadButton = document.createElement('button');
reloadButton.textContent = 'Reload';
reloadButton.addEventListener('click', () => {
  ui.reload();
});

const closeButton = document.createElement('button');
closeButton.textContent = 'Close';
closeButton.addEventListener('click', () => {
  dialog.close();
});


document.body.appendChild(reloadButton);
document.body.appendChild(closeButton);
