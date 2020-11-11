// Get options for selects
var selects = document.querySelectorAll('select');
for(var i = 0; i < selects.length; i++){
    selects[i].addEventListener('change', filter);
    var cat = selects[i].className.replace('select-', '');
    var cellsHaveThisCat = document.querySelectorAll('.cell-' + cat);
    for(var a = [], j = 0; j < cellsHaveThisCat.length; j++){
        a.push(cellsHaveThisCat[j].innerText);
        // deduplicate
        aa = a.filter(function(item, pos) {
            return a.indexOf(item) == pos;
        })
    }
    for(var j = 0; j < aa.length; j++){
        var opt = document.createElement('option');
        opt.value = aa[j];
        opt.innerHTML = aa[j];
        selects[i].appendChild(opt);
    }
}


function filter() {
    var rows = document.querySelectorAll('.table-row');
    for(var i = 0; i < rows.length; i++){
        rows[i].classList.remove('d-none');
        var cellsOfRow = rows[i].children;
        for(var j = 0; j < cellsOfRow.length; j++){
            var cat = cellsOfRow[j].className.replace('cell-', '');
            var selectHasThisCat = document.querySelector('.select-' + cat);
            if(selectHasThisCat.value !== '' && selectHasThisCat.value !== cellsOfRow[j].innerText){
                rows[i].classList.add('d-none');
                break;
            }
        }
    }

}
