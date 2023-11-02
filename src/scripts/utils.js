// O(n) in-place array shuffle.
function shuffle( a ) {
    // Durstenfeld shuffle:
    // (https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm)
    // -- To shuffle an array a of n elements (indices 0..n-1):
    // for i from n−1 down to 1 do
    //   j ← random integer such that 0 ≤ j ≤ i
    //   exchange a[j] and a[i]
    for ( let i = a.length - 1; i > 0; i-- ) {
        let j = Math.floor( Math.random() * ( i + 1 ) );
        let temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
}
