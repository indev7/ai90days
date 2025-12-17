import styles from './Pagination.module.css';

export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    onPageChange,
    itemName = 'items',
    loading = false
}) {
    if (loading || totalItems === 0 || totalPages <= 1) {
        return null;
    }

    return (
        <div className={styles.pagination}>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={styles.paginationButton}
            >
                Previous
            </button>
            <div className={styles.paginationInfo}>
                <span>Page {currentPage} of {totalPages}</span>
                <span className={styles.paginationTotal}>
                    ({totalItems} total {itemName})
                </span>
            </div>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className={styles.paginationButton}
            >
                Next
            </button>
        </div>
    );
}
